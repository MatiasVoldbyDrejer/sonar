import { getDb, mapInstrumentRow, mapTransactionRow, mapAccountRow } from '@/lib/db';
import { aggregatePositionsDKK } from '@/lib/portfolio-engine';
import { getBatchHistoricalRates, getBatchCurrentRates } from '@/lib/fx';
import type { Instrument, Position } from '@/types';

export async function loadPositions(): Promise<Position[]> {
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

  const currencies = new Set<string>();
  const historicalPairs: Array<{ currency: string; date: string }> = [];
  for (const tx of transactions) {
    const inst = instruments.get(tx.instrumentId);
    if (inst) {
      currencies.add(inst.currency);
      if (inst.currency !== 'DKK') {
        historicalPairs.push({ currency: inst.currency, date: tx.date });
      }
    }
  }

  const [historicalRates, currentRates] = await Promise.all([
    getBatchHistoricalRates(historicalPairs),
    getBatchCurrentRates([...currencies]),
  ]);

  return aggregatePositionsDKK(transactions, instruments, accounts, new Map(), historicalRates, currentRates);
}
