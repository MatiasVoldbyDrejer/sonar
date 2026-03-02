import { NextRequest, NextResponse } from 'next/server';
import { getDb, mapInstrumentRow } from '@/lib/db';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const row = db.prepare('SELECT * FROM instruments WHERE id = ?').get(id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(mapInstrumentRow(row as Record<string, unknown>));
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { isin, yahooSymbol, ticker, name, type, currency, exchange, hasQuoteSource } = body;

  const db = getDb();
  const existing = db.prepare('SELECT * FROM instruments WHERE id = ?').get(id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  db.prepare(
    `UPDATE instruments SET isin = ?, yahoo_symbol = ?, ticker = ?, name = ?, type = ?, currency = ?, exchange = ?, has_quote_source = ?
     WHERE id = ?`
  ).run(
    isin ?? (existing as Record<string, unknown>).isin,
    yahooSymbol !== undefined ? yahooSymbol : (existing as Record<string, unknown>).yahoo_symbol,
    ticker !== undefined ? ticker : (existing as Record<string, unknown>).ticker,
    name ?? (existing as Record<string, unknown>).name,
    type ?? (existing as Record<string, unknown>).type,
    currency ?? (existing as Record<string, unknown>).currency,
    exchange !== undefined ? exchange : (existing as Record<string, unknown>).exchange,
    hasQuoteSource !== undefined ? (hasQuoteSource ? 1 : 0) : (existing as Record<string, unknown>).has_quote_source,
    id
  );

  const updated = db.prepare('SELECT * FROM instruments WHERE id = ?').get(id);
  return NextResponse.json(mapInstrumentRow(updated as Record<string, unknown>));
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const txCount = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE instrument_id = ?').get(id) as { count: number };
  if (txCount.count > 0) {
    return NextResponse.json({ error: 'Cannot delete instrument with existing transactions' }, { status: 409 });
  }

  const result = db.prepare('DELETE FROM instruments WHERE id = ?').run(id);
  if (result.changes === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
