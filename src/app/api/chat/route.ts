import { streamText, convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';
import { createPerplexity } from '@ai-sdk/perplexity';
import { getDb, mapInstrumentRow, mapTransactionRow, mapAccountRow } from '@/lib/db';
import { marketAnalystSystemPrompt, portfolioAnalystSystemPrompt } from '@/lib/prompts';
import { aggregatePositionsDKK } from '@/lib/portfolio-engine';
import { getBatchHistoricalRates, getBatchCurrentRates } from '@/lib/fx';
import type { Instrument, Position, AgentType } from '@/types';

async function loadPositions(): Promise<Position[]> {
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

const perplexity = createPerplexity({
  apiKey: process.env.PERPLEXITY_API_KEY || '',
});

export async function POST(req: Request) {
  const body = await req.json();
  const agent: AgentType = body.agent ?? 'portfolio-analyst';

  if (!process.env.PERPLEXITY_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Perplexity API key not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const positions = await loadPositions();
  const systemPrompt = agent === 'market-analyst'
    ? marketAnalystSystemPrompt(positions)
    : portfolioAnalystSystemPrompt(positions);

  // Messages arrive as UIMessages (with parts) from the transport,
  // or as simple {role, content} from the daily trigger fetch.
  // convertToModelMessages handles UIMessage format; for simple format,
  // convert to UIMessage first.
  const rawMessages: unknown[] = body.messages ?? [];
  const uiMessages: UIMessage[] = rawMessages.map((m: any) => {
    if (m.parts) return m as UIMessage;
    // Simple {role, content} format from manual fetch
    return {
      id: m.id ?? `msg_${Date.now()}_${Math.random()}`,
      role: m.role,
      parts: [{ type: 'text' as const, text: m.content ?? '' }],
    };
  });

  const modelMessages = await convertToModelMessages(uiMessages);

  const result = streamText({
    model: perplexity('sonar-pro'),
    system: systemPrompt,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
