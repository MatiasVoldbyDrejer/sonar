import { NextRequest, NextResponse } from 'next/server';
import { getDb, mapInstrumentRow } from '@/lib/db';
import { parseNordnetCsv } from '@/lib/import/nordnet';
import { parseSaxoXlsx } from '@/lib/import/saxo';
import type { ParsedTransaction } from '@/lib/import/nordnet';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const accountId = formData.get('accountId') as string;
  const action = formData.get('action') as string; // 'preview' or 'commit'

  if (!file || !accountId) {
    return NextResponse.json({ error: 'File and accountId are required' }, { status: 400 });
  }

  let parsed: ParsedTransaction[] = [];

  if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
    const text = await file.text();
    parsed = parseNordnetCsv(text);
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
  const insertInstrument = db.prepare(
    `INSERT OR IGNORE INTO instruments (isin, name, type, currency) VALUES (?, ?, 'stock', ?)`
  );
  const getInstrument = db.prepare('SELECT * FROM instruments WHERE isin = ?');
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
      // Ensure instrument exists
      insertInstrument.run(tx.isin, tx.name, tx.currency);
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

  insertAll();

  return NextResponse.json({ imported, skipped, total: parsed.length });
}
