import { NextRequest, NextResponse } from 'next/server';
import { getDb, mapTransactionRow } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { accountId, instrumentId, type, date, quantity, price, fee, feeCurrency, notes } = body;

  const db = getDb();
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  db.prepare(
    `UPDATE transactions SET account_id = ?, instrument_id = ?, type = ?, date = ?, quantity = ?, price = ?, fee = ?, fee_currency = ?, notes = ?
     WHERE id = ?`
  ).run(
    accountId ?? existing.account_id,
    instrumentId ?? existing.instrument_id,
    type ?? existing.type,
    date ?? existing.date,
    quantity ?? existing.quantity,
    price ?? existing.price,
    fee ?? existing.fee,
    feeCurrency !== undefined ? feeCurrency : existing.fee_currency,
    notes !== undefined ? notes : existing.notes,
    id
  );

  const updated = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  return NextResponse.json(mapTransactionRow(updated as Record<string, unknown>));
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const result = db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  if (result.changes === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
