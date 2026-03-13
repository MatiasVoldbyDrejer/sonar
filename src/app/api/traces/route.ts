import { NextResponse } from 'next/server';
import { listTraces } from '@/lib/db';

export async function GET() {
  const traces = listTraces();
  return NextResponse.json(traces);
}
