/* eslint-disable @typescript-eslint/no-explicit-any */
import YahooFinance from 'yahoo-finance2';
import { getDb } from '@/lib/db';

const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] });

// In-memory cache for current FX rates (5min TTL)
interface CacheEntry {
  rate: number;
  timestamp: number;
}

const currentRateCache = new Map<string, CacheEntry>();
const RATE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get historical FX rate for a currency pair on a specific date.
 * Cached permanently in SQLite (historical rates don't change).
 */
export async function getHistoricalRate(from: string, to: string, date: string): Promise<number> {
  if (from === to) return 1.0;

  const pair = `${from}${to}`;
  const db = getDb();

  // Check SQLite cache first
  const cached = db.prepare('SELECT rate FROM fx_rates WHERE currency_pair = ? AND date = ?').get(pair, date) as { rate: number } | undefined;
  if (cached) return cached.rate;

  // Fetch from Yahoo Finance
  try {
    const symbol = `${pair}=X`;
    const targetDate = new Date(date);
    const dayBefore = new Date(targetDate);
    dayBefore.setDate(dayBefore.getDate() - 5); // go back 5 days to handle weekends/holidays

    const result: any = await yf.chart(symbol, {
      period1: dayBefore.toISOString().split('T')[0],
      period2: new Date(targetDate.getTime() + 86400000).toISOString().split('T')[0],
      interval: '1d',
    });

    const quotes = result.quotes || [];
    if (quotes.length === 0) {
      throw new Error(`No FX data for ${pair} on ${date}`);
    }

    // Find the closest quote on or before the target date
    let bestQuote: any = quotes[0];
    for (const q of quotes) {
      const qDate = new Date(q.date).toISOString().split('T')[0];
      if (qDate <= date) bestQuote = q;
    }

    const rate = bestQuote.close as number;
    if (!rate || rate <= 0) {
      throw new Error(`Invalid FX rate for ${pair} on ${date}`);
    }

    // Cache in SQLite (immutable historical data)
    db.prepare('INSERT OR IGNORE INTO fx_rates (currency_pair, date, rate) VALUES (?, ?, ?)').run(pair, date, rate);

    return rate;
  } catch (err) {
    // Fallback: try to find the nearest cached rate
    const nearest = db.prepare(
      'SELECT rate FROM fx_rates WHERE currency_pair = ? AND date <= ? ORDER BY date DESC LIMIT 1'
    ).get(pair, date) as { rate: number } | undefined;

    if (nearest) return nearest.rate;
    throw new Error(`Failed to get FX rate for ${pair} on ${date}: ${err}`);
  }
}

/**
 * Get current FX rate for a currency pair.
 * In-memory cache with 5min TTL.
 */
export async function getCurrentRate(from: string, to: string): Promise<number> {
  if (from === to) return 1.0;

  const pair = `${from}${to}`;
  const cached = currentRateCache.get(pair);
  if (cached && Date.now() - cached.timestamp < RATE_TTL) {
    return cached.rate;
  }

  try {
    const symbol = `${pair}=X`;
    const result: any = await yf.quote(symbol);
    const rate = result?.regularMarketPrice;

    if (!rate || rate <= 0) {
      return cached?.rate ?? 1.0;
    }

    currentRateCache.set(pair, { rate, timestamp: Date.now() });
    return rate;
  } catch {
    return cached?.rate ?? 1.0;
  }
}

/**
 * Get current FX rates for multiple currencies to DKK.
 * Returns a map of currency → DKK rate.
 */
export async function getBatchCurrentRates(currencies: string[]): Promise<Map<string, number>> {
  const rates = new Map<string, number>();
  rates.set('DKK', 1.0);

  const nonDkk = currencies.filter(c => c !== 'DKK');
  await Promise.allSettled(
    nonDkk.map(async (currency) => {
      const rate = await getCurrentRate(currency, 'DKK');
      rates.set(currency, rate);
    })
  );

  return rates;
}

/**
 * Get historical FX rates for a set of (currency, date) pairs to DKK.
 * Returns a map of "currency:date" → DKK rate.
 */
export async function getBatchHistoricalRates(
  pairs: Array<{ currency: string; date: string }>
): Promise<Map<string, number>> {
  const rates = new Map<string, number>();

  const nonDkk = pairs.filter(p => p.currency !== 'DKK');

  // Deduplicate
  const unique = new Map<string, { currency: string; date: string }>();
  for (const p of nonDkk) {
    const key = `${p.currency}:${p.date}`;
    unique.set(key, p);
  }

  await Promise.allSettled(
    [...unique.entries()].map(async ([key, { currency, date }]) => {
      const rate = await getHistoricalRate(currency, 'DKK', date);
      rates.set(key, rate);
    })
  );

  return rates;
}
