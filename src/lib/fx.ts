/* eslint-disable @typescript-eslint/no-explicit-any */
import YahooFinance from 'yahoo-finance2';
import { getDb } from '@/lib/db';
import { LRUCache, withTimeout } from '@/lib/resilience';

const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] });

// In-memory cache for current FX rates (5min TTL)
const RATE_TTL = 5 * 60 * 1000; // 5 minutes
const currentRateCache = new LRUCache<string, number>(50, RATE_TTL);

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

    const result: any = await withTimeout(yf.chart(symbol, {
      period1: dayBefore.toISOString().split('T')[0],
      period2: new Date(targetDate.getTime() + 86400000).toISOString().split('T')[0],
      interval: '1d',
    }), 10_000);

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
  if (cached !== undefined) return cached;

  try {
    const symbol = `${pair}=X`;
    const result: any = await withTimeout(yf.quote(symbol), 10_000);
    const rate = result?.regularMarketPrice;

    if (!rate || rate <= 0) {
      return currentRateCache.getStale(pair) ?? 1.0;
    }

    currentRateCache.set(pair, rate);
    return rate;
  } catch {
    return currentRateCache.getStale(pair) ?? 1.0;
  }
}

/**
 * Get current FX rates for multiple currencies to a target currency.
 * Returns a map of currency → target rate.
 */
export async function getBatchCurrentRates(currencies: string[], targetCurrency = 'DKK'): Promise<Map<string, number>> {
  const rates = new Map<string, number>();
  rates.set(targetCurrency, 1.0);

  const needsConversion = currencies.filter(c => c !== targetCurrency);
  await Promise.allSettled(
    needsConversion.map(async (currency) => {
      const rate = await getCurrentRate(currency, targetCurrency);
      rates.set(currency, rate);
    })
  );

  return rates;
}

/**
 * Get historical FX rates for a set of (currency, date) pairs to a target currency.
 * Returns a map of "currency:date" → target rate.
 */
export async function getBatchHistoricalRates(
  pairs: Array<{ currency: string; date: string }>,
  targetCurrency = 'DKK'
): Promise<Map<string, number>> {
  const rates = new Map<string, number>();

  const needsConversion = pairs.filter(p => p.currency !== targetCurrency);

  // Deduplicate
  const unique = new Map<string, { currency: string; date: string }>();
  for (const p of needsConversion) {
    const key = `${p.currency}:${p.date}`;
    unique.set(key, p);
  }

  await Promise.allSettled(
    [...unique.entries()].map(async ([key, { currency, date }]) => {
      const rate = await getHistoricalRate(currency, targetCurrency, date);
      rates.set(key, rate);
    })
  );

  return rates;
}
