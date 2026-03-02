import { NextResponse } from 'next/server';
import { getDb, mapInstrumentRow } from '@/lib/db';
import { getBatchQuotes } from '@/lib/market-data';

export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM instruments WHERE has_quote_source = 1 AND yahoo_symbol IS NOT NULL').all();
  const instruments = rows.map(r => mapInstrumentRow(r as Record<string, unknown>));
  const symbols = instruments.map(i => i.yahooSymbol!);
  const quotes = await getBatchQuotes(symbols);
  return NextResponse.json(Object.fromEntries(quotes));
}
