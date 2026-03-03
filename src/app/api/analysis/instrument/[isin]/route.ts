import { NextRequest, NextResponse } from 'next/server';
import { getDb, mapInstrumentRow } from '@/lib/db';
import { queryPerplexity } from '@/lib/perplexity';
import { deepDivePrompt } from '@/lib/prompts';

export async function POST(request: NextRequest, { params }: { params: Promise<{ isin: string }> }) {
  const { isin } = await params;
  const refresh = request.nextUrl.searchParams.get('refresh') === 'true';
  const db = getDb();

  const row = db.prepare('SELECT * FROM instruments WHERE isin = ?').get(isin);
  if (!row) {
    return NextResponse.json({ error: 'Instrument not found' }, { status: 404 });
  }

  const instrument = mapInstrumentRow(row as Record<string, unknown>);
  const cacheKey = `instrument:${isin}`;

  // Return cached analysis unless explicit refresh requested
  if (!refresh) {
    const cached = db.prepare(
      `SELECT * FROM analysis_cache WHERE cache_key = ?`
    ).get(cacheKey) as Record<string, unknown> | undefined;

    if (cached) {
      return NextResponse.json({
        content: cached.content,
        citations: cached.citations ? JSON.parse(cached.citations as string) : [],
        cached: true,
        createdAt: cached.created_at,
      });
    }
  }

  const prompt = deepDivePrompt(instrument.name, instrument.isin, instrument.ticker);
  const result = await queryPerplexity(prompt);

  db.prepare(
    `INSERT INTO analysis_cache (cache_key, content, citations, query_used, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(cache_key) DO UPDATE SET content = ?, citations = ?, query_used = ?, created_at = datetime('now')`
  ).run(
    cacheKey, result.content, JSON.stringify(result.citations), prompt,
    result.content, JSON.stringify(result.citations), prompt
  );

  return NextResponse.json({
    content: result.content,
    citations: result.citations,
    cached: false,
    createdAt: new Date().toISOString(),
  });
}
