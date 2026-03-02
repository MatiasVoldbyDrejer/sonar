import { NextRequest, NextResponse } from 'next/server';
import { getDb, mapInstrumentRow } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM instruments ORDER BY name').all();
  return NextResponse.json(rows.map(r => mapInstrumentRow(r as Record<string, unknown>)));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { isin, yahooSymbol, ticker, name, type, currency, exchange, hasQuoteSource } = body;

  if (!isin || !name || !type || !currency) {
    return NextResponse.json({ error: 'Missing required fields: isin, name, type, currency' }, { status: 400 });
  }

  const db = getDb();
  try {
    const result = db.prepare(
      `INSERT INTO instruments (isin, yahoo_symbol, ticker, name, type, currency, exchange, has_quote_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(isin, yahooSymbol || null, ticker || null, name, type, currency, exchange || null, hasQuoteSource !== false ? 1 : 0);

    const row = db.prepare('SELECT * FROM instruments WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(mapInstrumentRow(row as Record<string, unknown>), { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    if (message.includes('UNIQUE constraint')) {
      return NextResponse.json({ error: 'Instrument with this ISIN already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
