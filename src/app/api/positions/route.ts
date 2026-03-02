import { NextResponse } from 'next/server';
import { getDb, mapInstrumentRow, mapTransactionRow, mapAccountRow } from '@/lib/db';
import { aggregatePositionsDKK } from '@/lib/portfolio-engine';
import { getBatchQuotes } from '@/lib/market-data';
import { getBatchCurrentRates, getBatchHistoricalRates } from '@/lib/fx';
import type { Instrument } from '@/types';

export async function GET() {
  const db = getDb();

  const instrumentRows = db.prepare('SELECT * FROM instruments').all();
  const instruments = new Map<number, Instrument>();
  for (const row of instrumentRows) {
    const inst = mapInstrumentRow(row as Record<string, unknown>);
    instruments.set(inst.id, inst);
  }

  const accountRows = db.prepare('SELECT * FROM accounts').all();
  const accounts = new Map<number, string>();
  for (const row of accountRows) {
    const acc = mapAccountRow(row as Record<string, unknown>);
    accounts.set(acc.id, acc.name);
  }

  const transactionRows = db.prepare('SELECT * FROM transactions ORDER BY date, id').all();
  const transactions = transactionRows.map(r => mapTransactionRow(r as Record<string, unknown>));

  // Discover all currencies in the portfolio
  const currencies = new Set<string>();
  for (const inst of instruments.values()) {
    currencies.add(inst.currency);
  }

  // Collect (currency, date) pairs for historical FX rates from transactions
  const historicalPairs: Array<{ currency: string; date: string }> = [];
  for (const tx of transactions) {
    const inst = instruments.get(tx.instrumentId);
    if (inst && inst.currency !== 'DKK') {
      historicalPairs.push({ currency: inst.currency, date: tx.date });
    }
  }

  // Fetch current prices + FX rates in parallel
  const symbols = [...instruments.values()]
    .filter(i => i.hasQuoteSource && i.yahooSymbol)
    .map(i => i.yahooSymbol!);

  const [quotes, currentRates, historicalRates] = await Promise.all([
    getBatchQuotes(symbols),
    getBatchCurrentRates([...currencies]),
    getBatchHistoricalRates(historicalPairs),
  ]);

  const currentPrices = new Map<string, number>();
  for (const [symbol, quote] of quotes) {
    currentPrices.set(symbol, quote.price);
  }

  const positions = aggregatePositionsDKK(
    transactions,
    instruments,
    accounts,
    currentPrices,
    historicalRates,
    currentRates
  );

  return NextResponse.json(positions);
}
