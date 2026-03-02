import { NextRequest, NextResponse } from 'next/server';
import { searchSymbol } from '@/lib/market-data';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  if (!query) {
    return NextResponse.json({ error: 'Query parameter q is required' }, { status: 400 });
  }
  const results = await searchSymbol(query);
  return NextResponse.json(results);
}
