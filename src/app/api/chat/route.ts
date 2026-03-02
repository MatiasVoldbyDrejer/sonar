import { streamText, convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';
import { createPerplexity } from '@ai-sdk/perplexity';
import { marketAnalystSystemPrompt, portfolioAnalystSystemPrompt } from '@/lib/prompts';
import { loadPositions } from '@/lib/load-positions';
import type { AgentType } from '@/types';

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
