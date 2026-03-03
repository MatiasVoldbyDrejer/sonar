import { NextRequest, NextResponse } from 'next/server';
import { getDb, mapInstrumentRow } from '@/lib/db';
import { parseNordnetCsv } from '@/lib/import/nordnet';
import { parseSaxoXlsx } from '@/lib/import/saxo';
import { parseSydbankCsv } from '@/lib/import/sydbank';
import { searchSymbol } from '@/lib/market-data';
import type { ParsedTransaction } from '@/lib/import/nordnet';

function mapQuoteType(quoteType: string): 'stock' | 'fund' | 'etf' | 'crypto' {
  const t = quoteType.toLowerCase();
  if (t === 'etf') return 'etf';
  if (t === 'mutualfund') return 'fund';
  if (t === 'cryptocurrency') return 'crypto';
  return 'stock';
}

export async function POST(request: NextRequest) {
  try {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const accountId = formData.get('accountId') as string;
  const action = formData.get('action') as string; // 'preview' or 'commit'

  if (!file || !accountId) {
    return NextResponse.json({ error: 'File and accountId are required' }, { status: 400 });
  }

  let parsed: ParsedTransaction[] = [];

  if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
    // Detect UTF-16 encoding (BOM or null bytes) and decode appropriately
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let text: string;
    if ((bytes[0] === 0xFF && bytes[1] === 0xFE) || (bytes[0] === 0xFE && bytes[1] === 0xFF)) {
      // UTF-16 BOM detected
      const decoder = new TextDecoder(bytes[0] === 0xFF ? 'utf-16le' : 'utf-16be');
      text = decoder.decode(buffer);
    } else if (bytes.length > 2 && bytes[1] === 0x00) {
      // No BOM but null bytes suggest UTF-16LE
      text = new TextDecoder('utf-16le').decode(buffer);
    } else {
      text = new TextDecoder('utf-8').decode(buffer);
    }
    // Auto-detect Sydbank vs Nordnet by checking for Sydbank-specific headers
    const headerLine = text.split('\n')[0]?.toLowerCase() ?? '';
    const isSydbank = headerLine.includes('fondskode') || headerLine.includes('depotnummer');
    parsed = isSydbank ? parseSydbankCsv(text) : parseNordnetCsv(text);
  } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    parsed = parseSaxoXlsx(buffer);
  } else {
    return NextResponse.json({ error: 'Unsupported file format. Use CSV or XLSX.' }, { status: 400 });
  }

  if (parsed.length === 0) {
    return NextResponse.json({ error: 'No valid transactions found in file' }, { status: 400 });
  }

  if (action === 'preview') {
    return NextResponse.json({ transactions: parsed, count: parsed.length });
  }

  // Commit — insert into DB
  const db = getDb();

  // Resolve new instruments via Yahoo Finance before inserting
  const getInstrument = db.prepare('SELECT * FROM instruments WHERE isin = ?');
  const uniqueIsins = [...new Set(parsed.map(tx => tx.isin))];
  const newIsins = uniqueIsins.filter(isin => !getInstrument.get(isin));

  // Lookup Yahoo Finance data for new instruments in parallel
  const yahooData = new Map<string, { symbol: string; name: string; exchange: string; type: string }>();
  if (newIsins.length > 0) {
    await Promise.allSettled(
      newIsins.map(async (isin) => {
        try {
          const results = await searchSymbol(isin);
          if (results.length > 0) {
            yahooData.set(isin, results[0]);
          }
        } catch {
          // silently skip — will fall back to basic insert
        }
      })
    );
  }

  const insertInstrumentFull = db.prepare(
    `INSERT OR IGNORE INTO instruments (isin, yahoo_symbol, ticker, name, type, currency, exchange, has_quote_source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertInstrumentBasic = db.prepare(
    `INSERT OR IGNORE INTO instruments (isin, name, type, currency) VALUES (?, ?, 'stock', ?)`
  );
  const insertTransaction = db.prepare(
    `INSERT INTO transactions (account_id, instrument_id, type, date, quantity, price, fee, fee_currency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const checkDuplicate = db.prepare(
    `SELECT id FROM transactions
     WHERE account_id = ? AND instrument_id = ? AND type = ? AND date = ?
     AND quantity = ? AND price = ?`
  );

  let imported = 0;
  let skipped = 0;
  const insertAll = db.transaction(() => {
    for (const tx of parsed) {
      // Ensure instrument exists — use Yahoo data if available
      const yahoo = yahooData.get(tx.isin);
      if (yahoo) {
        const ticker = yahoo.symbol.includes('.') ? yahoo.symbol.split('.')[0] : yahoo.symbol;
        insertInstrumentFull.run(
          tx.isin,
          yahoo.symbol,
          ticker,
          yahoo.name || tx.name,
          mapQuoteType(yahoo.type),
          tx.currency,
          yahoo.exchange || null,
          1
        );
      } else {
        insertInstrumentBasic.run(tx.isin, tx.name, tx.currency);
      }

      const instrument = getInstrument.get(tx.isin) as Record<string, unknown>;
      if (!instrument) continue;

      const inst = mapInstrumentRow(instrument);

      // Check for duplicate
      const existing = checkDuplicate.get(accountId, inst.id, tx.type, tx.date, tx.quantity, tx.price);
      if (existing) {
        skipped++;
        continue;
      }

      insertTransaction.run(accountId, inst.id, tx.type, tx.date, tx.quantity, tx.price, tx.fee, tx.feeCurrency);
      imported++;
    }
  });

  try {
    insertAll();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Import failed: ${message}` }, { status: 500 });
  }

  return NextResponse.json({ imported, skipped, total: parsed.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Import error:', err);
    return NextResponse.json({ error: `Import failed: ${message}` }, { status: 500 });
  }
}
