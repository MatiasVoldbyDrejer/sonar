/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getDb, mapInstrumentRow, mapTransactionRow, mapAccountRow, getSetting } from '@/lib/db';
import { aggregatePositions } from '@/lib/portfolio-engine';
import { getBatchQuotes, getAssetProfile, getFundHoldings } from '@/lib/market-data';
import type { FundHoldings } from '@/lib/market-data';
import { getBatchCurrentRates, getBatchHistoricalRates } from '@/lib/fx';
import type { Instrument, AllocationSlice, DeepDiveData, DiversificationScore } from '@/types';

export async function GET() {
  const db = getDb();
  const reportingCurrency = getSetting('reporting_currency') ?? 'DKK';

  // Load instruments
  const instrumentRows = db.prepare('SELECT * FROM instruments').all();
  const instruments = new Map<number, Instrument>();
  for (const row of instrumentRows) {
    const inst = mapInstrumentRow(row as Record<string, unknown>);
    instruments.set(inst.id, inst);
  }

  // Lazy-fill missing classification data
  const unclassified = [...instruments.values()].filter(
    i => i.sector === null && i.yahooSymbol
  );

  if (unclassified.length > 0) {
    const updateStmt = db.prepare(
      'UPDATE instruments SET sector = ?, industry = ?, country = ? WHERE id = ?'
    );

    await Promise.allSettled(
      unclassified.map(async (inst) => {
        const profile = await getAssetProfile(inst.yahooSymbol!);
        if (profile) {
          updateStmt.run(profile.sector, profile.industry, profile.country, inst.id);
          inst.sector = profile.sector;
          inst.industry = profile.industry;
          inst.country = profile.country;
        }
      })
    );
  }

  // Load accounts
  const accountRows = db.prepare('SELECT * FROM accounts').all();
  const accounts = new Map<number, string>();
  for (const row of accountRows) {
    const acc = mapAccountRow(row as Record<string, unknown>);
    accounts.set(acc.id, acc.name);
  }

  // Load transactions
  const transactionRows = db.prepare('SELECT * FROM transactions ORDER BY date, id').all();
  const transactions = transactionRows.map(r => mapTransactionRow(r as Record<string, unknown>));

  // Discover currencies
  const currencies = new Set<string>();
  for (const inst of instruments.values()) {
    currencies.add(inst.currency);
  }

  // Historical FX pairs
  const historicalPairs: Array<{ currency: string; date: string }> = [];
  for (const tx of transactions) {
    const inst = instruments.get(tx.instrumentId);
    if (inst && inst.currency !== reportingCurrency) {
      historicalPairs.push({ currency: inst.currency, date: tx.date });
    }
  }

  // Identify fund/ETF instruments for look-through
  const fundInstruments = [...instruments.values()].filter(
    i => (i.type === 'fund' || i.type === 'etf') && i.yahooSymbol
  );

  // Fetch quotes + FX rates + fund holdings in parallel
  const symbols = [...instruments.values()]
    .filter(i => i.hasQuoteSource && i.yahooSymbol)
    .map(i => i.yahooSymbol!);

  const [quotes, currentRates, historicalRates, ...fundHoldingsResults] = await Promise.all([
    getBatchQuotes(symbols),
    getBatchCurrentRates([...currencies], reportingCurrency),
    getBatchHistoricalRates(historicalPairs, reportingCurrency),
    ...fundInstruments.map(async (inst) => ({
      isin: inst.isin,
      ticker: inst.ticker,
      holdings: await getFundHoldings(inst.yahooSymbol!),
    })),
  ]);

  const fundHoldingsMap = new Map<string, { ticker: string | null; holdings: FundHoldings }>();
  for (const result of fundHoldingsResults) {
    if (result.holdings) {
      fundHoldingsMap.set(result.isin, { ticker: result.ticker, holdings: result.holdings });
    }
  }

  const currentPrices = new Map<string, number>();
  for (const [symbol, quote] of quotes) {
    currentPrices.set(symbol, quote.price);
  }

  const positions = aggregatePositions(
    transactions,
    instruments,
    accounts,
    currentPrices,
    historicalRates,
    currentRates,
    reportingCurrency
  );

  // Merge positions by instrument (across accounts)
  const mergedByIsin = new Map<string, {
    instrument: Instrument;
    value: number;
    costBasis: number;
    unrealizedGainLoss: number;
    realizedGainLoss: number;
  }>();
  let totalRealizedGainLoss = 0;
  let totalDividends = 0;

  for (const pos of positions) {
    totalDividends += pos.totalDividends;
    if (pos.quantity <= 0 || !pos.currentValue) continue;
    const existing = mergedByIsin.get(pos.instrument.isin);
    if (existing) {
      existing.value += pos.currentValue;
      existing.costBasis += pos.costBasis;
      existing.unrealizedGainLoss += pos.unrealizedGainLoss;
      existing.realizedGainLoss += pos.realizedGainLoss;
    } else {
      mergedByIsin.set(pos.instrument.isin, {
        instrument: pos.instrument,
        value: pos.currentValue,
        costBasis: pos.costBasis,
        unrealizedGainLoss: pos.unrealizedGainLoss,
        realizedGainLoss: pos.realizedGainLoss,
      });
    }
    totalRealizedGainLoss += pos.realizedGainLoss;
  }

  const totalValue = [...mergedByIsin.values()].reduce((sum, p) => sum + p.value, 0);
  const totalCostBasis = [...mergedByIsin.values()].reduce((sum, p) => sum + p.costBasis, 0);
  const totalUnrealizedGainLoss = [...mergedByIsin.values()].reduce((sum, p) => sum + p.unrealizedGainLoss, 0);
  const totalUnrealizedGainLossPercent = totalCostBasis > 0 ? (totalUnrealizedGainLoss / totalCostBasis) * 100 : 0;
  const holdingCount = mergedByIsin.size;

  // Top holdings — merge fund underlying stocks with direct positions
  const effectiveHoldings = new Map<string, {
    name: string; ticker: string | null; isin: string;
    value: number; costBasis: number; unrealizedGainLoss: number;
    viaFund: string | null;
  }>();

  for (const pos of mergedByIsin.values()) {
    const fh = fundHoldingsMap.get(pos.instrument.isin);
    if (fh && fh.holdings.holdings.length > 0) {
      // Decompose fund into its underlying stock holdings
      for (const h of fh.holdings.holdings) {
        if (h.holdingPercent <= 0) continue;
        const key = h.symbol || h.holdingName;
        const holdingValue = pos.value * h.holdingPercent;
        const holdingCost = pos.costBasis * h.holdingPercent;
        const holdingGL = pos.unrealizedGainLoss * h.holdingPercent;
        const existing = effectiveHoldings.get(key);
        if (existing) {
          existing.value += holdingValue;
          existing.costBasis += holdingCost;
          existing.unrealizedGainLoss += holdingGL;
          existing.viaFund = null; // merged with direct
        } else {
          effectiveHoldings.set(key, {
            name: h.holdingName, ticker: h.symbol || null, isin: key,
            value: holdingValue, costBasis: holdingCost, unrealizedGainLoss: holdingGL,
            viaFund: fh.ticker,
          });
        }
      }
    } else {
      // Direct position
      const key = pos.instrument.yahooSymbol || pos.instrument.isin;
      const existing = effectiveHoldings.get(key);
      if (existing) {
        existing.value += pos.value;
        existing.costBasis += pos.costBasis;
        existing.unrealizedGainLoss += pos.unrealizedGainLoss;
        existing.name = pos.instrument.name;
        existing.ticker = pos.instrument.ticker;
        existing.isin = pos.instrument.isin;
        existing.viaFund = null;
      } else {
        effectiveHoldings.set(key, {
          name: pos.instrument.name, ticker: pos.instrument.ticker, isin: pos.instrument.isin,
          value: pos.value, costBasis: pos.costBasis, unrealizedGainLoss: pos.unrealizedGainLoss,
          viaFund: null,
        });
      }
    }
  }

  const sortedEffective = [...effectiveHoldings.values()].sort((a, b) => b.value - a.value);
  const top5 = sortedEffective.slice(0, 5);
  const top5Concentration = totalValue > 0 ? top5.reduce((sum, h) => sum + (h.value / totalValue) * 100, 0) : 0;
  const topHoldings = top5.map(h => ({
    name: h.viaFund ? `${h.name} (via ${h.viaFund})` : h.name,
    ticker: h.ticker,
    isin: h.isin,
    value: h.value,
    weight: totalValue > 0 ? (h.value / totalValue) * 100 : 0,
    unrealizedGainLoss: h.unrealizedGainLoss,
    unrealizedGainLossPercent: h.costBasis > 0 ? (h.unrealizedGainLoss / h.costBasis) * 100 : 0,
  }));

  // Separate classified, decomposed funds, and unclassified
  const classified: Array<{ instrument: Instrument; value: number; costBasis: number; unrealizedGainLoss: number }> = [];
  const unclassifiedPositions: Array<{ name: string; isin: string; value: number }> = [];
  const decomposedFunds: Array<{
    instrument: Instrument;
    value: number;
    costBasis: number;
    unrealizedGainLoss: number;
    fundData: { ticker: string | null; holdings: FundHoldings };
  }> = [];

  for (const pos of mergedByIsin.values()) {
    const { instrument, value, costBasis, unrealizedGainLoss } = pos;
    const fh = fundHoldingsMap.get(instrument.isin);

    if (fh && fh.holdings.sectorWeightings.size > 0) {
      decomposedFunds.push({ instrument, value, costBasis, unrealizedGainLoss, fundData: fh });
    } else if (instrument.sector) {
      classified.push({ instrument, value, costBasis, unrealizedGainLoss });
    } else {
      unclassifiedPositions.push({ name: instrument.name, isin: instrument.isin, value });
    }
  }

  const unclassifiedValue = unclassifiedPositions.reduce((s, p) => s + p.value, 0);
  const classifiedTotal = totalValue - unclassifiedValue;

  type AllocGroup = {
    value: number;
    costBasis: number;
    unrealizedGainLoss: number;
    instruments: Array<{
      name: string; isin: string; value: number; percentage: number;
      costBasis: number; unrealizedGainLoss: number; unrealizedGainLossPercent: number;
    }>;
  };

  function groupsToSlices(groups: Map<string, AllocGroup>): AllocationSlice[] {
    return [...groups.entries()]
      .map(([name, { value, costBasis, unrealizedGainLoss, instruments: instrs }]) => ({
        name,
        value,
        percentage: classifiedTotal > 0 ? (value / classifiedTotal) * 100 : 0,
        costBasis,
        unrealizedGainLoss,
        unrealizedGainLossPercent: costBasis > 0 ? (unrealizedGainLoss / costBasis) * 100 : 0,
        instruments: instrs.sort((a, b) => b.value - a.value),
      }))
      .sort((a, b) => b.value - a.value);
  }

  function addToGroup(groups: Map<string, AllocGroup>, groupName: string, entry: {
    name: string; isin: string; value: number; costBasis: number; unrealizedGainLoss: number;
  }) {
    const group = groups.get(groupName) ?? { value: 0, costBasis: 0, unrealizedGainLoss: 0, instruments: [] };
    group.value += entry.value;
    group.costBasis += entry.costBasis;
    group.unrealizedGainLoss += entry.unrealizedGainLoss;
    group.instruments.push({
      name: entry.name,
      isin: entry.isin,
      value: entry.value,
      percentage: classifiedTotal > 0 ? (entry.value / classifiedTotal) * 100 : 0,
      costBasis: entry.costBasis,
      unrealizedGainLoss: entry.unrealizedGainLoss,
      unrealizedGainLossPercent: entry.costBasis > 0 ? (entry.unrealizedGainLoss / entry.costBasis) * 100 : 0,
    });
    groups.set(groupName, group);
  }

  // Sector allocation: decompose funds by sector weightings
  function buildSectorAllocation(): AllocationSlice[] {
    const groups = new Map<string, AllocGroup>();

    for (const { instrument, value, costBasis, unrealizedGainLoss } of classified) {
      addToGroup(groups, instrument.sector ?? 'Unknown', {
        name: instrument.name, isin: instrument.isin, value, costBasis, unrealizedGainLoss,
      });
    }

    for (const fund of decomposedFunds) {
      for (const [sectorName, weight] of fund.fundData.holdings.sectorWeightings) {
        const label = fund.fundData.ticker
          ? `${fund.instrument.name} (via ${fund.fundData.ticker})`
          : fund.instrument.name;
        addToGroup(groups, sectorName, {
          name: label,
          isin: `${fund.instrument.isin}:${sectorName}`,
          value: fund.value * weight,
          costBasis: fund.costBasis * weight,
          unrealizedGainLoss: fund.unrealizedGainLoss * weight,
        });
      }
    }

    return groupsToSlices(groups);
  }

  // Industry/Country allocation: funds as single "Diversified" entry
  function buildAllocation(key: 'industry' | 'country'): AllocationSlice[] {
    const groups = new Map<string, AllocGroup>();

    for (const { instrument, value, costBasis, unrealizedGainLoss } of classified) {
      addToGroup(groups, instrument[key] ?? 'Unknown', {
        name: instrument.name, isin: instrument.isin, value, costBasis, unrealizedGainLoss,
      });
    }

    for (const fund of decomposedFunds) {
      addToGroup(groups, 'Diversified', {
        name: fund.instrument.name, isin: fund.instrument.isin,
        value: fund.value, costBasis: fund.costBasis, unrealizedGainLoss: fund.unrealizedGainLoss,
      });
    }

    return groupsToSlices(groups);
  }

  const sectorAllocation = buildSectorAllocation();
  const industryAllocation = buildAllocation('industry');
  const countryAllocation = buildAllocation('country');

  // Compute HHI (Herfindahl-Hirschman Index)
  function computeHHI(slices: AllocationSlice[]): number {
    return slices.reduce((sum, s) => sum + s.percentage * s.percentage, 0);
  }

  const sectorHHI = computeHHI(sectorAllocation);
  const industryHHI = computeHHI(industryAllocation);
  const countryHHI = computeHHI(countryAllocation);

  const weightedHHI = sectorHHI * 0.4 + industryHHI * 0.3 + countryHHI * 0.3;
  const overall = Math.max(0, Math.min(100, 100 - weightedHHI / 100));

  let label: DiversificationScore['label'];
  if (overall < 25) label = 'Low';
  else if (overall < 50) label = 'Moderate';
  else if (overall < 75) label = 'Good';
  else label = 'Excellent';

  const diversification: DiversificationScore = {
    overall: Math.round(overall),
    sectorHHI: Math.round(sectorHHI),
    industryHHI: Math.round(industryHHI),
    countryHHI: Math.round(countryHHI),
    label,
  };

  const data: DeepDiveData = {
    totalValue,
    totalCostBasis,
    totalUnrealizedGainLoss,
    totalUnrealizedGainLossPercent,
    totalRealizedGainLoss: totalRealizedGainLoss,
    totalDividends,
    holdingCount,
    top5Concentration,
    reportingCurrency,
    topHoldings,
    sectorAllocation,
    industryAllocation,
    countryAllocation,
    diversification,
    unclassifiedValue,
    unclassifiedInstruments: unclassifiedPositions,
  };

  return NextResponse.json(data);
}
