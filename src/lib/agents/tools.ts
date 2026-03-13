import { tool } from 'ai';
import { z } from 'zod';
import { getQuoteWithStats, getChart, searchSymbol, getFundHoldings } from '@/lib/market-data';
import { getCurrentRate } from '@/lib/fx';
import { getDb, getSetting, getAgentMemories, upsertAgentMemory, deleteAgentMemory } from '@/lib/db';
import { loadPositions } from '@/lib/load-positions';
import { GET as getDeepDiveData } from '@/app/api/deepdive/route';
import { createRecurringTask, listRecurringTasks, updateRecurringTask } from '@/lib/recurring-tasks-db';
import { scheduleTask, unscheduleTask, rescheduleTask } from '@/lib/scheduler';
import type { Position } from '@/types';

export const quoteTool = tool({
  description:
    'Get live price, day change, and key stats (PE, market cap, 52-week range, dividend yield) for any instrument by Yahoo Finance symbol.',
  inputSchema: z.object({
    symbol: z.string().describe('Yahoo Finance symbol (e.g. NOVO-B.CO, AAPL, ISAC.L)'),
  }),
  execute: async ({ symbol }) => {
    const result = await getQuoteWithStats(symbol);
    if (!result) return { error: `No quote data found for ${symbol}` };

    const { quote, stats } = result;
    return {
      symbol: quote.symbol,
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
      currency: quote.currency,
      marketState: quote.marketState,
      previousClose: stats.previousClose,
      dayHigh: stats.dayHigh,
      dayLow: stats.dayLow,
      fiftyTwoWeekHigh: stats.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: stats.fiftyTwoWeekLow,
      marketCap: stats.marketCap,
      peRatio: stats.peRatio,
      dividendYield: stats.dividendYield,
    };
  },
});

export const portfolioAnalysisTool = tool({
  description:
    'Get portfolio-level analysis: sector/country allocation, diversification score, concentration metrics, top holdings by weight.',
  inputSchema: z.object({}),
  execute: async () => {
    const response = await getDeepDiveData();
    const data = await response.json();

    return {
      totalValue: data.totalValue,
      totalCostBasis: data.totalCostBasis,
      unrealizedGainLoss: data.totalUnrealizedGainLoss,
      unrealizedGainLossPercent: data.totalUnrealizedGainLossPercent,
      realizedGainLoss: data.totalRealizedGainLoss,
      totalDividends: data.totalDividends,
      holdingCount: data.holdingCount,
      reportingCurrency: data.reportingCurrency,
      top5Concentration: data.top5Concentration,
      topHoldings: data.topHoldings,
      sectorAllocation: data.sectorAllocation.map((s: Record<string, unknown>) => ({
        name: s.name,
        percentage: s.percentage,
        value: s.value,
      })),
      countryAllocation: data.countryAllocation.map((s: Record<string, unknown>) => ({
        name: s.name,
        percentage: s.percentage,
        value: s.value,
      })),
      diversification: {
        overall: data.diversification.overall,
        label: data.diversification.label,
      },
    };
  },
});

export const chartTool = tool({
  description:
    'Get historical price data and performance metrics for an instrument over a specified period.',
  inputSchema: z.object({
    symbol: z.string().describe('Yahoo Finance symbol'),
    period: z
      .enum(['1m', '3m', '6m', '1y', '5y'])
      .optional()
      .default('1y')
      .describe('Time period (default: 1y)'),
  }),
  execute: async ({ symbol, period }) => {
    const dataPoints = await getChart(symbol, period);
    if (dataPoints.length === 0) return { error: `No chart data found for ${symbol}` };

    const closes = dataPoints.map(d => d.close);
    const high = Math.max(...closes);
    const low = Math.min(...closes);
    const firstClose = closes[0];
    const lastClose = closes[closes.length - 1];
    const periodReturn = ((lastClose - firstClose) / firstClose) * 100;

    // Sample ~20 evenly-spaced points for trend shape
    const maxPoints = 20;
    const step = Math.max(1, Math.floor(dataPoints.length / maxPoints));
    const sampled = dataPoints.filter((_, i) => i % step === 0 || i === dataPoints.length - 1);

    return {
      symbol,
      period,
      periodReturn: Math.round(periodReturn * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      currentPrice: lastClose,
      dataPointCount: dataPoints.length,
      dataPoints: sampled.map(d => ({ date: d.date, close: Math.round(d.close * 100) / 100 })),
    };
  },
});

export const transactionsTool = tool({
  description:
    'Get the investor\'s trade history for a specific instrument (buys, sells, dividends with dates, quantities, prices).',
  inputSchema: z.object({
    isin: z.string().describe('ISIN of the instrument'),
  }),
  execute: async ({ isin }) => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT t.type, t.date, t.quantity, t.price, t.fee, a.name as account_name
      FROM transactions t
      JOIN instruments i ON t.instrument_id = i.id
      JOIN accounts a ON t.account_id = a.id
      WHERE i.isin = ?
      ORDER BY t.date, t.id
    `).all(isin) as Array<{
      type: string; date: string; quantity: number; price: number; fee: number; account_name: string;
    }>;

    if (rows.length === 0) return { error: `No transactions found for ISIN ${isin}` };

    return {
      isin,
      transactions: rows.map(r => ({
        type: r.type,
        date: r.date,
        quantity: r.quantity,
        price: r.price,
        fee: r.fee,
        accountName: r.account_name,
      })),
    };
  },
});

export const searchInstrumentTool = tool({
  description:
    'Search for instruments by name or ticker symbol. Use to find Yahoo Finance symbols for instruments not in the portfolio.',
  inputSchema: z.object({
    query: z.string().describe('Search query (company name, ticker, etc.)'),
  }),
  execute: async ({ query }) => {
    const results = await searchSymbol(query);
    if (results.length === 0) return { error: `No results found for "${query}"` };
    return { results };
  },
});

// --- New tools ---

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('da-DK', { style: 'currency', currency, minimumFractionDigits: 0 }).format(value);
}

let cachedPositions: Position[] | null = null;
let positionsCacheTime = 0;
const POSITIONS_TTL = 60 * 1000; // 1 minute

async function getCachedPositions(): Promise<Position[]> {
  if (cachedPositions && Date.now() - positionsCacheTime < POSITIONS_TTL) {
    return cachedPositions;
  }
  cachedPositions = await loadPositions();
  positionsCacheTime = Date.now();
  return cachedPositions;
}

export const holdingsTool = tool({
  description:
    "Get the investor's current portfolio holdings with quantities, cost basis, and current values. Use this when the user asks about their portfolio, holdings, or specific instruments they own.",
  inputSchema: z.object({}),
  execute: async () => {
    const positions = await getCachedPositions();
    const active = positions.filter(p => p.quantity > 0);

    if (active.length === 0) return { holdings: [], reportingCurrency: 'DKK' };

    const reportingCurrency = active[0]?.reportingCurrency || 'DKK';

    return {
      reportingCurrency,
      holdings: active.map(p => ({
        name: p.instrument.name,
        isin: p.instrument.isin,
        ticker: p.instrument.ticker,
        symbol: p.instrument.yahooSymbol,
        type: p.instrument.type,
        quantity: p.quantity,
        currency: p.instrument.currency,
        costBasis: Math.round(p.costBasis * 100) / 100,
        currentValue: p.currentValue !== null ? Math.round(p.currentValue * 100) / 100 : null,
        currentValueFormatted: p.currentValue !== null ? formatCurrency(p.currentValue, reportingCurrency) : null,
        unrealizedGainLoss: p.currentValue !== null ? Math.round((p.currentValue - p.costBasis) * 100) / 100 : null,
      })),
    };
  },
});

export const portfolioPerformanceTool = tool({
  description:
    'Get portfolio value over time with return metrics. Shows how the total portfolio has performed over a given period.',
  inputSchema: z.object({
    period: z
      .enum(['1m', '3m', '6m', '1y', '5y'])
      .optional()
      .default('1y')
      .describe('Time period (default: 1y)'),
  }),
  execute: async ({ period }) => {
    const url = new URL('http://localhost:3100/api/portfolio/chart');
    url.searchParams.set('period', period);
    const request = new (await import('next/server')).NextRequest(url);

    const { GET } = await import('@/app/api/portfolio/chart/route');
    const response = await GET(request);
    const dataPoints = await response.json();

    if (!dataPoints || dataPoints.length === 0) {
      return { error: 'No portfolio chart data available' };
    }

    const closes = dataPoints.map((d: { close: number }) => d.close);
    const high = Math.max(...closes);
    const low = Math.min(...closes);
    const startValue = closes[0];
    const endValue = closes[closes.length - 1];
    const returnPercent = ((endValue - startValue) / startValue) * 100;

    // Sample ~20 points
    const maxPoints = 20;
    const step = Math.max(1, Math.floor(dataPoints.length / maxPoints));
    const sampled = dataPoints.filter((_: unknown, i: number) => i % step === 0 || i === dataPoints.length - 1);

    return {
      period,
      startValue: Math.round(startValue * 100) / 100,
      endValue: Math.round(endValue * 100) / 100,
      returnPercent: Math.round(returnPercent * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      dataPoints: sampled.map((d: { date: string; close: number }) => ({
        date: d.date,
        close: Math.round(d.close * 100) / 100,
      })),
    };
  },
});

export const portfolioValueTool = tool({
  description:
    'Get the current portfolio value and gains over 1 day, 7 days, and 30 days.',
  inputSchema: z.object({}),
  execute: async () => {
    // Use live positions for current value (matches dashboard)
    const positions = await getCachedPositions();
    const active = positions.filter(p => p.quantity > 0 && p.currentValue !== null);
    const currentValue = active.reduce((sum, p) => sum + (p.currentValue ?? 0), 0);

    if (active.length === 0) {
      return { error: 'No portfolio data available' };
    }

    // Use chart data for historical comparisons
    const url = new URL('http://localhost:3100/api/portfolio/chart');
    url.searchParams.set('period', '1m');
    const request = new (await import('next/server')).NextRequest(url);
    const { GET } = await import('@/app/api/portfolio/chart/route');
    const response = await GET(request);
    const dataPoints = await response.json();

    function valueNDaysAgo(days: number): number | null {
      if (!dataPoints || dataPoints.length === 0) return null;
      const target = new Date();
      target.setDate(target.getDate() - days);
      const targetStr = target.toISOString().split('T')[0];
      for (let i = dataPoints.length - 1; i >= 0; i--) {
        if (dataPoints[i].date <= targetStr) return dataPoints[i].close;
      }
      return null;
    }

    function computeGain(pastValue: number | null) {
      if (pastValue == null) return null;
      return {
        absolute: Math.round((currentValue - pastValue) * 100) / 100,
        percent: Math.round(((currentValue - pastValue) / pastValue) * 10000) / 100,
      };
    }

    return {
      currentValue: Math.round(currentValue * 100) / 100,
      gain1d: computeGain(valueNDaysAgo(1)),
      gain7d: computeGain(valueNDaysAgo(7)),
      gain30d: computeGain(valueNDaysAgo(30)),
    };
  },
});

export const fxRateTool = tool({
  description:
    'Get the current exchange rate between two currencies.',
  inputSchema: z.object({
    from: z.string().describe('Source currency code (e.g. USD, EUR)'),
    to: z.string().describe('Target currency code (e.g. DKK, SEK)'),
  }),
  execute: async ({ from, to }) => {
    const rate = await getCurrentRate(from.toUpperCase(), to.toUpperCase());
    return {
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      rate: Math.round(rate * 10000) / 10000,
    };
  },
});

const MEMORY_CAP = 50;

export const saveMemoryTool = tool({
  description:
    'Save a memory about the investor for future conversations. Use when the user shares preferences, corrects your approach, or reveals investment theses. Memories persist across all conversations.',
  inputSchema: z.object({
    name: z.string().describe('Kebab-case identifier for the memory (e.g. "prefers-bullet-points", "bullish-on-novo")'),
    type: z.enum(['preference', 'feedback', 'investment']).describe('preference = communication/analysis style, feedback = corrections to your approach, investment = theses, watchlist rationale'),
    content: z.string().describe('The memory content (1-3 concise sentences)'),
  }),
  execute: async ({ name, type, content }) => {
    const existing = getAgentMemories();
    const isUpdate = existing.some(m => m.name === name);
    if (!isUpdate && existing.length >= MEMORY_CAP) {
      return { error: `Memory cap reached (${MEMORY_CAP}). Update or delete existing memories first.` };
    }
    upsertAgentMemory(name, type, content);
    return { saved: true, name, type, action: isUpdate ? 'updated' : 'created' };
  },
});

export const deleteMemoryTool = tool({
  description:
    'Delete a previously saved memory by name. Use when the user asks you to forget something or when a memory is no longer relevant.',
  inputSchema: z.object({
    name: z.string().describe('The kebab-case name of the memory to delete'),
  }),
  execute: async ({ name }) => {
    const deleted = deleteAgentMemory(name);
    return deleted
      ? { deleted: true, name }
      : { deleted: false, error: `No memory found with name "${name}"` };
  },
});

export const fundHoldingsTool = tool({
  description:
    'Get the top holdings and sector weightings of a fund or ETF by Yahoo Finance symbol.',
  inputSchema: z.object({
    symbol: z.string().describe('Yahoo Finance symbol of the fund/ETF (e.g. ISAC.L, SPY)'),
  }),
  execute: async ({ symbol }) => {
    const data = await getFundHoldings(symbol);
    if (!data) return { error: `No fund holdings data found for ${symbol}` };

    return {
      symbol,
      holdings: data.holdings.map(h => ({
        name: h.holdingName,
        symbol: h.symbol,
        weight: Math.round(h.holdingPercent * 10000) / 100, // Convert to percentage
      })),
      sectorWeightings: [...data.sectorWeightings.entries()].map(([sector, weight]) => ({
        sector,
        weight: Math.round(weight * 10000) / 100,
      })),
    };
  },
});

export const createRecurringTaskTool = tool({
  description:
    'Create a recurring scheduled task that runs automatically on a cron schedule. Use when the investor asks for periodic updates, daily briefings, or any repeated analysis.',
  inputSchema: z.object({
    name: z.string().describe('Short name for the task (e.g. "Daily Portfolio Update")'),
    prompt: z.string().describe('The prompt to execute on each run — write it as if the investor is asking you directly'),
    schedule: z.string().describe('Cron expression (e.g. "0 10 * * *" for daily at 10am, "0 9 * * 1" for Mondays at 9am)'),
    model: z.enum(['sonnet', 'opus', 'gemini-flash', 'gemini-flash-lite'])
      .optional()
      .describe('Model to use for task execution. Choose based on task complexity: gemini-flash for simple summaries/updates, sonnet for analysis requiring reasoning, opus for complex multi-step research.'),
  }),
  execute: async ({ name, prompt, schedule, model }) => {
    const cron = await import('node-cron');
    if (!cron.validate(schedule)) {
      return { error: `Invalid cron expression: "${schedule}"` };
    }

    const timezone = getSetting('timezone') || 'Europe/Copenhagen';
    const task = createRecurringTask(name, prompt, schedule, timezone, model || 'gemini-flash');
    scheduleTask(task);

    return {
      created: true,
      id: task.id,
      name: task.name,
      prompt,
      schedule: task.cronExpression,
      timezone: task.timezone,
      active: true,
      model: task.model || 'gemini-flash',
    };
  },
});

export const toggleRecurringTaskTool = tool({
  description:
    'Pause or resume a recurring task. Use list_recurring_tasks first to find the task ID.',
  inputSchema: z.object({
    task_id: z.number().describe('ID of the recurring task'),
    active: z.boolean().describe('true to activate/resume, false to pause'),
  }),
  execute: async ({ task_id, active }) => {
    const updated = updateRecurringTask(task_id, { active });
    if (!updated) return { error: `Task ${task_id} not found` };

    if (active) {
      rescheduleTask(updated);
    } else {
      unscheduleTask(task_id);
    }

    return { id: task_id, active: updated.active, name: updated.name };
  },
});

export const listRecurringTasksTool = tool({
  description:
    'List all recurring tasks with their schedules and status. Use to find task IDs for toggling or managing tasks.',
  inputSchema: z.object({}),
  execute: async () => {
    const tasks = listRecurringTasks();
    return {
      tasks: tasks.map(t => ({
        id: t.id,
        name: t.name,
        prompt: t.prompt,
        schedule: t.cronExpression,
        timezone: t.timezone,
        active: t.active,
        lastRunAt: t.lastRunAt,
      })),
    };
  },
});
