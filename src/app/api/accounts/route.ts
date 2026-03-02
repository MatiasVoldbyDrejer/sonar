import { NextRequest, NextResponse } from 'next/server';
import { getDb, mapAccountRow } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM accounts ORDER BY name').all();
  return NextResponse.json(rows.map(r => mapAccountRow(r as Record<string, unknown>)));
}

export async function POST(request: NextRequest) {
  const { name, broker } = await request.json();
  if (!name || !broker) {
    return NextResponse.json({ error: 'Missing required fields: name, broker' }, { status: 400 });
  }
  if (!['saxo', 'nordnet'].includes(broker)) {
    return NextResponse.json({ error: 'Broker must be saxo or nordnet' }, { status: 400 });
  }

  const db = getDb();
  const result = db.prepare('INSERT INTO accounts (name, broker) VALUES (?, ?)').run(name, broker);
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(mapAccountRow(row as Record<string, unknown>), { status: 201 });
}
