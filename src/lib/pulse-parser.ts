import type { PulseItem, PulseResponse, PulseSignalType } from '@/types';

const VALID_SIGNAL_TYPES: Set<string> = new Set([
  'earnings', 'risk', 'analyst-change', 'opportunity', 'catalyst', 'news',
]);

const MAX_ITEMS = 5;
const MAX_HEADLINE = 120;
const MAX_EXPLANATION = 300;
const MAX_ACTION = 200;
const MAX_SUMMARY = 300;

function cap(s: unknown, max: number): string {
  const str = typeof s === 'string' ? s.trim() : '';
  return str.length > max ? str.slice(0, max).trimEnd() + '...' : str;
}

function validateItem(raw: Record<string, unknown>, knownIsins: Set<string>): PulseItem | null {
  const isin = typeof raw.isin === 'string' ? raw.isin.trim() : '';
  if (!isin || !knownIsins.has(isin)) return null;

  const headline = cap(raw.headline, MAX_HEADLINE);
  if (!headline) return null;

  const signalType = typeof raw.signalType === 'string' && VALID_SIGNAL_TYPES.has(raw.signalType)
    ? raw.signalType as PulseSignalType
    : 'news';

  return {
    isin,
    ticker: typeof raw.ticker === 'string' ? raw.ticker.trim() || null : null,
    instrumentName: cap(raw.instrumentName, 100) || isin,
    signalType,
    headline,
    explanation: cap(raw.explanation, MAX_EXPLANATION),
    suggestedAction: cap(raw.suggestedAction, MAX_ACTION),
  };
}

function tryParseJSON(text: string): unknown {
  // Layer 1: extract from markdown code fence
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]); } catch { /* fall through */ }
  }

  // Layer 2: try entire content as raw JSON
  try { return JSON.parse(text); } catch { /* fall through */ }

  return null;
}

export function parsePulseResponse(content: string, knownIsins: Set<string>): PulseResponse {
  const parsed = tryParseJSON(content);

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    const summary = cap(obj.summary, MAX_SUMMARY) || 'Portfolio pulse generated.';
    const rawItems = Array.isArray(obj.items) ? obj.items : [];

    const items: PulseItem[] = [];
    for (const raw of rawItems) {
      if (items.length >= MAX_ITEMS) break;
      if (typeof raw === 'object' && raw !== null) {
        const valid = validateItem(raw as Record<string, unknown>, knownIsins);
        if (valid) items.push(valid);
      }
    }

    return { summary, items };
  }

  // Layer 3: graceful degradation — treat raw text as summary
  const fallbackSummary = cap(content.replace(/[#*`]/g, '').trim(), MAX_SUMMARY) || 'Unable to parse pulse data.';
  return { summary: fallbackSummary, items: [] };
}
