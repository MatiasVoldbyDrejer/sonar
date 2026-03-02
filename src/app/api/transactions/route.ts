import { NextRequest, NextResponse } from 'next/server';
import { getDb, mapTransactionRow } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const accountId = searchParams.get('accountId');
  const instrumentId = searchParams.get('instrumentId');

  const db = getDb();
  let query = 'SELECT * FROM transactions WHERE 1=1';
  const params: unknown[] = [];

  if (accountId) {
    query += ' AND account_id = ?';
    params.push(accountId);
  }
  if (instrumentId) {
    query += ' AND instrument_id = ?';
    params.push(instrumentId);
  }

  query += ' ORDER BY date DESC, id DESC';
  const rows = db.prepare(query).all(...params);
  return NextResponse.json(rows.map(r => mapTransactionRow(r as Record<string, unknown>)));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { accountId, instrumentId, type, date, quantity, price, fee, feeCurrency, notes } = body;

  if (!accountId || !instrumentId || !type || !date || quantity == null || price == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const db = getDb();
  const result = db.prepare(
    `INSERT INTO transactions (account_id, instrument_id, type, date, quantity, price, fee, fee_currency, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(accountId, instrumentId, type, date, quantity, price, fee || 0, feeCurrency || null, notes || null);

  const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(mapTransactionRow(row as Record<string, unknown>), { status: 201 });
}
