import { NextRequest, NextResponse } from 'next/server';
import { getTraceById } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trace = getTraceById(id);
  if (!trace) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(trace);
}
