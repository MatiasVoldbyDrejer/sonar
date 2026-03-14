import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { loadPositions } from '@/lib/load-positions';
import { queryPerplexity } from '@/lib/perplexity';
import { pulsePrompt } from '@/lib/prompts';
import { getInvestorProfile } from '@/lib/profile';
import { parsePulseResponse } from '@/lib/pulse-parser';
import { apiError } from '@/lib/resilience';
import type { PulseResponse } from '@/types';

const SIX_HOURS = 6 * 60 * 60 * 1000;

function todayCacheKey(): string {
  return `pulse:${new Date().toISOString().split('T')[0]}`;
}

function getCached(): { data: PulseResponse; createdAt: string } | 'empty' | 'expired' {
  const db = getDb();
  const row = db.prepare(
    'SELECT content, created_at FROM analysis_cache WHERE cache_key = ? LIMIT 1'
  ).get(todayCacheKey()) as { content: string; created_at: string } | undefined;

  if (!row) return 'empty';

  const createdAt = new Date(row.created_at + 'Z');
  if (Date.now() - createdAt.getTime() > SIX_HOURS) return 'expired';

  try {
    const data = JSON.parse(row.content) as PulseResponse;
    return { data, createdAt: row.created_at };
  } catch {
    return 'expired';
  }
}

export async function GET() {
  const cached = getCached();

  if (cached === 'empty') {
    return NextResponse.json({ status: 'empty' });
  }
  if (cached === 'expired') {
    return NextResponse.json({ status: 'expired' });
  }

  return NextResponse.json({
    status: 'ok',
    ...cached.data,
    createdAt: cached.createdAt,
  });
}

export async function POST() {
  if (!process.env.PERPLEXITY_API_KEY) {
    return NextResponse.json(
      { error: 'Perplexity API key not configured' },
      { status: 500 }
    );
  }

  const positions = await loadPositions();
  const active = positions.filter(p => p.quantity > 0);

  if (active.length === 0) {
    return NextResponse.json({
      status: 'ok',
      summary: 'No active holdings to analyze.',
      items: [],
    });
  }

  const profile = getInvestorProfile();
  const prompt = pulsePrompt(active, profile);

  let content: string;
  try {
    ({ content } = await queryPerplexity(prompt));
  } catch (error) {
    console.error('Pulse generation failed:', error);
    return apiError('Pulse generation failed', 500);
  }

  const knownIsins = new Set(active.map(p => p.instrument.isin));
  const pulse = parsePulseResponse(content, knownIsins);

  // Store parsed JSON in cache
  const db = getDb();
  const cacheKey = todayCacheKey();
  db.prepare(
    `INSERT INTO analysis_cache (cache_key, content, query_used)
     VALUES (?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET content = excluded.content, query_used = excluded.query_used, created_at = datetime('now')`
  ).run(cacheKey, JSON.stringify(pulse), 'pulse');

  return NextResponse.json({
    status: 'ok',
    ...pulse,
    createdAt: new Date().toISOString(),
  });
}
