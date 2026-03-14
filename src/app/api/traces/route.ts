import { NextResponse } from 'next/server';
import { listTraces } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor') ?? undefined;
  const search = searchParams.get('q') ?? undefined;
  const limit = 30;
  const traces = listTraces(limit, cursor, search);
  return NextResponse.json({ traces, hasMore: traces.length === limit });
}
