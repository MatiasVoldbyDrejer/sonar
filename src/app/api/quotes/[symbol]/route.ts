import { NextRequest, NextResponse } from 'next/server';
import { getQuoteWithStats } from '@/lib/market-data';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const result = await getQuoteWithStats(symbol);
  if (!result) {
    return NextResponse.json({ error: 'Quote not available' }, { status: 404 });
  }
  return NextResponse.json(result);
}
