import { NextRequest, NextResponse } from 'next/server';
import { getChart } from '@/lib/market-data';

export async function GET(request: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const period = request.nextUrl.searchParams.get('period') || '1y';
  const data = await getChart(symbol, period);
  return NextResponse.json(data);
}
