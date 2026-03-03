/* eslint-disable @typescript-eslint/no-explicit-any */
import YahooFinance from 'yahoo-finance2';
import type { Quote, ChartDataPoint, InstrumentStats } from '@/types';

// yahoo-finance2 v3 requires instantiation
const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] });

// In-memory cache with TTL
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const quoteCache = new Map<string, CacheEntry<Quote>>();
const chartCache = new Map<string, CacheEntry<ChartDataPoint[]>>();
const fundHoldingsCache = new Map<string, CacheEntry<FundHoldings>>();
const QUOTE_TTL = 5 * 60 * 1000; // 5 minutes
const CHART_TTL = 30 * 60 * 1000; // 30 minutes
const FUND_HOLDINGS_TTL = 24 * 60 * 60 * 1000; // 24 hours

export interface FundHolding {
  symbol: string;
  holdingName: string;
  holdingPercent: number;
}

export interface FundHoldings {
  holdings: FundHolding[];
  sectorWeightings: Map<string, number>;
}

const SECTOR_NAME_MAP: Record<string, string> = {
  realestate: 'Real Estate',
  consumer_cyclical: 'Consumer Cyclical',
  basic_materials: 'Basic Materials',
  consumer_defensive: 'Consumer Defensive',
  technology: 'Technology',
  communication_services: 'Communication Services',
  financial_services: 'Financial Services',
  utilities: 'Utilities',
  industrials: 'Industrials',
  energy: 'Energy',
  healthcare: 'Healthcare',
};

export async function getQuote(symbol: string): Promise<Quote | null> {
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < QUOTE_TTL) {
    return cached.data;
  }

  try {
    const result: any = await yf.quote(symbol);
    if (!result || !result.regularMarketPrice) return cached?.data ?? null;

    const quote: Quote = {
      symbol,
      price: result.regularMarketPrice,
      change: result.regularMarketChange ?? 0,
      changePercent: result.regularMarketChangePercent ?? 0,
      currency: result.currency ?? 'USD',
      marketState: result.marketState ?? 'CLOSED',
      updatedAt: new Date().toISOString(),
    };

    quoteCache.set(symbol, { data: quote, timestamp: Date.now() });
    return quote;
  } catch {
    return cached?.data ?? null;
  }
}

export async function getBatchQuotes(symbols: string[]): Promise<Map<string, Quote>> {
  const results = new Map<string, Quote>();
  await Promise.allSettled(
    symbols.map(async (symbol) => {
      const quote = await getQuote(symbol);
      if (quote) results.set(symbol, quote);
    })
  );
  return results;
}

export async function getQuoteWithStats(symbol: string): Promise<{ quote: Quote; stats: InstrumentStats } | null> {
  try {
    const result: any = await yf.quote(symbol);
    if (!result || !result.regularMarketPrice) return null;

    const quote: Quote = {
      symbol,
      price: result.regularMarketPrice,
      change: result.regularMarketChange ?? 0,
      changePercent: result.regularMarketChangePercent ?? 0,
      currency: result.currency ?? 'USD',
      marketState: result.marketState ?? 'CLOSED',
      updatedAt: new Date().toISOString(),
    };

    const stats: InstrumentStats = {
      previousClose: result.regularMarketPreviousClose ?? null,
      dayHigh: result.regularMarketDayHigh ?? null,
      dayLow: result.regularMarketDayLow ?? null,
      fiftyTwoWeekHigh: result.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: result.fiftyTwoWeekLow ?? null,
      marketCap: result.marketCap ?? null,
      peRatio: result.trailingPE ?? null,
      dividendYield: result.dividendYield ?? null,
    };

    quoteCache.set(symbol, { data: quote, timestamp: Date.now() });
    return { quote, stats };
  } catch {
    return null;
  }
}

export async function getChart(symbol: string, period: string = '1y'): Promise<ChartDataPoint[]> {
  const cacheKey = `${symbol}:${period}`;
  const cached = chartCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CHART_TTL) {
    return cached.data;
  }

  try {
    const result: any = await yf.chart(symbol, {
      period1: getStartDate(period),
      interval: getInterval(period),
    });

    const data: ChartDataPoint[] = (result.quotes || [])
      .filter((q: any) => q.close != null)
      .map((q: any) => ({
        date: new Date(q.date).toISOString().split('T')[0],
        close: q.close as number,
        volume: q.volume as number | undefined,
      }));

    chartCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch {
    return cached?.data ?? [];
  }
}

export async function searchSymbol(query: string) {
  try {
    const results: any = await yf.search(query, { quotesCount: 10, newsCount: 0 });
    return mapSearchQuotes(results.quotes || []);
  } catch (err: any) {
    // yahoo-finance2 throws validation errors but includes parsed data in err.result
    if (err?.result?.quotes) {
      return mapSearchQuotes(err.result.quotes);
    }
    return [];
  }
}

function mapSearchQuotes(quotes: any[]) {
  return quotes.map((q: any) => ({
    symbol: q.symbol as string,
    name: (q.shortname || q.longname || '') as string,
    exchange: (q.exchDisp || q.exchange || '') as string,
    type: (q.quoteType || '') as string,
  }));
}

export async function getAssetProfile(symbol: string): Promise<{ sector: string; industry: string; country: string } | null> {
  try {
    const result: any = await yf.quoteSummary(symbol, { modules: ['assetProfile'] });
    const profile = result?.assetProfile;
    if (!profile) return null;

    const sector = profile.sector as string | undefined;
    const industry = profile.industry as string | undefined;
    const country = profile.country as string | undefined;

    if (!sector && !industry && !country) return null;

    return {
      sector: sector ?? 'Unknown',
      industry: industry ?? 'Unknown',
      country: country ?? 'Unknown',
    };
  } catch {
    return null;
  }
}

function getStartDate(period: string): string {
  const now = new Date();
  switch (period) {
    case '1m': now.setMonth(now.getMonth() - 1); break;
    case '3m': now.setMonth(now.getMonth() - 3); break;
    case '6m': now.setMonth(now.getMonth() - 6); break;
    case '1y': now.setFullYear(now.getFullYear() - 1); break;
    case '5y': now.setFullYear(now.getFullYear() - 5); break;
    default: now.setFullYear(now.getFullYear() - 1);
  }
  return now.toISOString().split('T')[0];
}

function getInterval(period: string): '1d' | '1wk' | '1mo' {
  switch (period) {
    case '1m':
    case '3m': return '1d';
    case '6m':
    case '1y': return '1d';
    case '5y': return '1wk';
    default: return '1d';
  }
}

export async function getFundHoldings(symbol: string): Promise<FundHoldings | null> {
  const cached = fundHoldingsCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < FUND_HOLDINGS_TTL) {
    return cached.data;
  }

  try {
    const result: any = await yf.quoteSummary(symbol, { modules: ['topHoldings'] });
    const th = result?.topHoldings;
    if (!th) return cached?.data ?? null;

    const holdings: FundHolding[] = (th.holdings || []).map((h: any) => ({
      symbol: (h.symbol as string) ?? '',
      holdingName: (h.holdingName as string) ?? 'Unknown',
      holdingPercent: (h.holdingPercent as number) ?? 0,
    }));

    const sectorWeightings = new Map<string, number>();
    for (const entry of (th.sectorWeightings || [])) {
      for (const [key, value] of Object.entries(entry)) {
        if (key === 'maxAge') continue;
        const name = SECTOR_NAME_MAP[key] ?? key;
        if (typeof value === 'number' && value > 0) {
          sectorWeightings.set(name, value);
        }
      }
    }

    const data: FundHoldings = { holdings, sectorWeightings };
    fundHoldingsCache.set(symbol, { data, timestamp: Date.now() });
    return data;
  } catch {
    return cached?.data ?? null;
  }
}
