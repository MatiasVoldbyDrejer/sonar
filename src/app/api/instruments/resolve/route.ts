import { NextRequest, NextResponse } from 'next/server';
import { searchSymbol } from '@/lib/market-data';

export async function POST(request: NextRequest) {
  const { isin } = await request.json();
  if (!isin) {
    return NextResponse.json({ error: 'ISIN is required' }, { status: 400 });
  }

  try {
    const results = await searchSymbol(isin);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [], error: 'Search failed — enter symbol manually' });
  }
}
