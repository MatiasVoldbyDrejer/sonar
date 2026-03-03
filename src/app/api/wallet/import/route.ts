import { NextRequest, NextResponse } from 'next/server';
import { getDb, mapInstrumentRow, mapAccountRow } from '@/lib/db';
import {
  fetchAllTransactions,
  mapToTransactions,
  lookupHistoricalPrices,
  CHAINS,
  type WalletParsedTransaction,
} from '@/lib/import/etherscan';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, address, chains } = body as {
    action: 'connect' | 'sync';
    address: string;
    chains?: number[];
  };

  if (!address || !ADDRESS_RE.test(address)) {
    return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 });
  }

  // "connect" — just persist the wallet address, no Etherscan fetch needed
  if (action === 'connect') {
    const acc = findOrCreateAccount(address);
    return NextResponse.json({ accountId: acc.id, accountName: acc.name });
  }

  // "sync" — fetch from Etherscan and upsert
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ETHERSCAN_API_KEY not configured' }, { status: 500 });
  }

  const chainIds = chains?.length
    ? chains.filter(id => CHAINS.some(c => c.chainId === id))
    : CHAINS.map(c => c.chainId);

  if (chainIds.length === 0) {
    return NextResponse.json({ error: 'No valid chains selected' }, { status: 400 });
  }

  try {
    const rawData = await fetchAllTransactions(address, chainIds, apiKey);
    const transactions = mapToTransactions(rawData, address);
    await lookupHistoricalPrices(transactions);
    return upsertTransactions(transactions, address);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Fetch failed: ${message}` }, { status: 500 });
  }
}

function findOrCreateAccount(address: string) {
  const db = getDb();
  const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;
  let row = db.prepare('SELECT * FROM accounts WHERE wallet_address = ?').get(address) as Record<string, unknown> | undefined;

  if (!row) {
    const result = db.prepare(
      'INSERT INTO accounts (name, broker, wallet_address) VALUES (?, ?, ?)'
    ).run(`MetaMask ${truncated}`, 'metamask', address);
    row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>;
  }

  return mapAccountRow(row!);
}

function upsertTransactions(transactions: WalletParsedTransaction[], address: string) {
  const db = getDb();
  const acc = findOrCreateAccount(address);

  const insertInstrument = db.prepare(
    `INSERT OR IGNORE INTO instruments (isin, yahoo_symbol, ticker, name, type, currency, has_quote_source)
     VALUES (?, ?, ?, ?, 'crypto', 'USD', ?)`
  );
  const getInstrument = db.prepare('SELECT * FROM instruments WHERE isin = ?');
  const insertTransaction = db.prepare(
    `INSERT INTO transactions (account_id, instrument_id, type, date, quantity, price, fee, fee_currency, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  // Dedup by txHash only — price may change between fetches
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

  return NextResponse.json({
    imported,
    skipped,
    total: transactions.length,
    accountId: acc.id,
    accountName: acc.name,
  });
}
