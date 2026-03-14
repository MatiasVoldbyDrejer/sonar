import { NextRequest, NextResponse } from 'next/server';
import { getDb, mapInstrumentRow, mapTransactionRow, getSetting } from '@/lib/db';
import { getChart } from '@/lib/market-data';
import { getBatchHistoricalRates } from '@/lib/fx';
import { LRUCache } from '@/lib/resilience';
import type { ChartDataPoint } from '@/types';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const portfolioChartCache = new LRUCache<string, ChartDataPoint[]>(10, CACHE_TTL);

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

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get('period') || '1y';

  // Check cache
  const cached = portfolioChartCache.get(period);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const db = getDb();
    const reportingCurrency = getSetting('reporting_currency') ?? 'DKK';

    // Load instruments and transactions
    const instrumentRows = db.prepare('SELECT * FROM instruments').all() as Record<string, unknown>[];
    const instruments = instrumentRows.map(mapInstrumentRow);

    const transactionRows = db.prepare(
      'SELECT * FROM transactions ORDER BY date, id'
    ).all() as Record<string, unknown>[];
    const transactions = transactionRows.map(mapTransactionRow);

    if (transactions.length === 0) {
      return NextResponse.json([]);
    }

    // Filter instruments with Yahoo symbols
    const instrumentsWithSymbol = instruments.filter((i) => i.yahooSymbol);
    const instrumentMap = new Map(instruments.map((i) => [i.id, i]));

    if (instrumentsWithSymbol.length === 0) {
      return NextResponse.json([]);
    }

    // Compute start date, clamped to earliest transaction
    let startDate = getStartDate(period);
    const earliestTx = transactions[0].date;
    if (startDate < earliestTx) {
      startDate = earliestTx;
    }

    // Fetch chart data for all instruments in parallel
    const priceDataMap = new Map<string, Map<string, number>>(); // yahooSymbol → date → close

    await Promise.allSettled(
      instrumentsWithSymbol.map(async (inst) => {
        const chartData = await getChart(inst.yahooSymbol!, period);
        const dateMap = new Map<string, number>();
        for (const point of chartData) {
          if (point.date >= startDate) {
            dateMap.set(point.date, point.close);
          }
        }
        priceDataMap.set(inst.yahooSymbol!, dateMap);
      })
    );

    // Collect all unique dates from price data
    const allDatesSet = new Set<string>();
    for (const dateMap of priceDataMap.values()) {
      for (const date of dateMap.keys()) {
        allDatesSet.add(date);
      }
    }
    const allDates = [...allDatesSet].sort();

    if (allDates.length === 0) {
      return NextResponse.json([]);
    }

    // Forward-fill prices: for each instrument, fill gaps up to 7 days
    for (const [, dateMap] of priceDataMap) {
      let lastPrice: number | null = null;
      let lastDate: string | null = null;
      for (const date of allDates) {
        if (dateMap.has(date)) {
          lastPrice = dateMap.get(date)!;
          lastDate = date;
        } else if (lastPrice !== null && lastDate !== null) {
          const gap = (new Date(date).getTime() - new Date(lastDate).getTime()) / 86400000;
          if (gap <= 7) {
            dateMap.set(date, lastPrice);
          }
        }
      }
    }

    // Filter transactions to those within range
    const relevantTxs = transactions.filter((tx) => {
      const inst = instrumentMap.get(tx.instrumentId);
      return inst?.yahooSymbol != null;
    });

    // Collect unique currencies for FX
    const uniqueCurrencies = new Set<string>();
    for (const inst of instrumentsWithSymbol) {
      if (inst.currency !== reportingCurrency) {
        uniqueCurrencies.add(inst.currency);
      }
    }

    // Pre-fetch FX rates for all (currency, date) pairs
    const fxPairs: Array<{ currency: string; date: string }> = [];
    for (const currency of uniqueCurrencies) {
      for (const date of allDates) {
        fxPairs.push({ currency, date });
      }
    }
    const fxRates = await getBatchHistoricalRates(fxPairs, reportingCurrency);

    function getFxRate(currency: string, date: string): number {
      if (currency === reportingCurrency) return 1.0;
      return fxRates.get(`${currency}:${date}`) ?? 1.0;
    }

    // Walk transactions + dates together to compute portfolio value
    const runningQuantities = new Map<number, number>(); // instrumentId → quantity
    let txIdx = 0;

    const result: ChartDataPoint[] = [];

    for (const date of allDates) {
      // Process all transactions on or before this date
      while (txIdx < relevantTxs.length && relevantTxs[txIdx].date <= date) {
        const tx = relevantTxs[txIdx];
        const current = runningQuantities.get(tx.instrumentId) || 0;
        if (tx.type === 'buy') {
          runningQuantities.set(tx.instrumentId, current + tx.quantity);
        } else {
          runningQuantities.set(tx.instrumentId, current - tx.quantity);
        }
        txIdx++;
      }

      // Sum portfolio value for this date
      let totalValue = 0;
      for (const [instrumentId, qty] of runningQuantities) {
        if (qty <= 0) continue;
        const inst = instrumentMap.get(instrumentId);
        if (!inst?.yahooSymbol) continue;

        const dateMap = priceDataMap.get(inst.yahooSymbol);
        const price = dateMap?.get(date);
        if (price == null) continue;

        const fxRate = getFxRate(inst.currency, date);
        totalValue += qty * price * fxRate;
      }

      if (totalValue > 0) {
        result.push({ date, close: Math.round(totalValue * 100) / 100 });
      }
    }

    // Cache result
    portfolioChartCache.set(period, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Portfolio chart error:', error);
    return NextResponse.json([], { status: 500 });
  }
}
