import { NextResponse } from 'next/server';
import { getDb, mapAccountRow, mapInstrumentRow } from '@/lib/db';
import {
  fetchAllTransactions,
  mapToTransactions,
  lookupHistoricalPrices,
  CHAINS,
  type WalletParsedTransaction,
} from '@/lib/import/etherscan';

export async function POST() {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ETHERSCAN_API_KEY not configured' }, { status: 500 });
  }

  const db = getDb();
  const walletAccounts = (db.prepare(
    "SELECT * FROM accounts WHERE broker = 'metamask' AND wallet_address IS NOT NULL"
  ).all() as Record<string, unknown>[]).map(mapAccountRow);

  if (walletAccounts.length === 0) {
    return NextResponse.json({ synced: 0, message: 'No wallets connected' });
  }

  const chainIds = CHAINS.map(c => c.chainId);
  let totalImported = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  for (const acc of walletAccounts) {
    if (!acc.walletAddress) continue;

    try {
      const rawData = await fetchAllTransactions(acc.walletAddress, chainIds, apiKey);
      const transactions = mapToTransactions(rawData, acc.walletAddress);
      await lookupHistoricalPrices(transactions);

      const { imported, skipped } = upsertForAccount(db, acc, transactions);
      totalImported += imported;
      totalSkipped += skipped;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${acc.name}: ${msg}`);
    }
  }

  return NextResponse.json({
    synced: walletAccounts.length,
    imported: totalImported,
    skipped: totalSkipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}

function upsertForAccount(
  db: ReturnType<typeof getDb>,
  acc: ReturnType<typeof mapAccountRow>,
  transactions: WalletParsedTransaction[],
) {
  const insertInstrument = db.prepare(
    `INSERT OR IGNORE INTO instruments (isin, yahoo_symbol, ticker, name, type, currency, has_quote_source)
     VALUES (?, ?, ?, ?, 'crypto', 'USD', ?)`
  );
  const getInstrument = db.prepare('SELECT * FROM instruments WHERE isin = ?');
  const insertTransaction = db.prepare(
    `INSERT INTO transactions (account_id, instrument_id, type, date, quantity, price, fee, fee_currency, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const checkDuplicate = db.prepare(
    `SELECT id FROM transactions WHERE account_id = ? AND notes = ?`
  );

  let imported = 0;
  let skipped = 0;

  const insertAll = db.transaction(() => {
    for (const tx of transactions) {
      insertInstrument.run(
        tx.isin, tx.yahooSymbol, tx.ticker, tx.name,
        tx.hasQuoteSource ? 1 : 0,
      );

      const instrument = getInstrument.get(tx.isin) as Record<string, unknown>;
      if (!instrument) continue;
      const inst = mapInstrumentRow(instrument);

      const noteKey = `tx:${tx.txHash}:${tx.type}`;
      const existing = checkDuplicate.get(acc.id, noteKey);
      if (existing) {
        skipped++;
        continue;
      }

      insertTransaction.run(
        acc.id, inst.id, tx.type, tx.date,
        tx.quantity, tx.price, tx.fee, tx.feeCurrency,
        noteKey
      );
      imported++;
    }
  });

  insertAll();

  return { imported, skipped };
}
