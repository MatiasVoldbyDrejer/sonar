import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { marketAnalystSystemPrompt, portfolioAnalystSystemPrompt } from '@/lib/prompts';
import { loadPositions } from '@/lib/load-positions';
import type { AgentType } from '@/types';

const client = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY || '',
  baseURL: 'https://api.perplexity.ai',
});

export async function POST(req: Request) {
  const body = await req.json();
  const agent: AgentType = body.agent ?? 'portfolio-analyst';

  if (!process.env.PERPLEXITY_API_KEY) {
    return NextResponse.json(
      { error: 'Perplexity API key not configured' },
      { status: 500 }
    );
  }

  const positions = await loadPositions();
  const systemPrompt = agent === 'market-analyst'
    ? marketAnalystSystemPrompt(positions)
    : portfolioAnalystSystemPrompt(positions);

  const rawMessages: Array<{ role: string; content: string }> = body.messages ?? [];

  // Perplexity requires strictly alternating user/assistant messages,
  // starting with a user message. Daily briefings produce consecutive
  // assistant messages, so we need to normalize the history.
  const filtered = rawMessages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  // Ensure it starts with a user message
  if (filtered.length > 0 && filtered[0].role !== 'user') {
    filtered.unshift({ role: 'user', content: 'Provide your daily briefing and portfolio scan.' });
  }

  // Merge consecutive same-role messages to enforce alternation
  const chatMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const msg of filtered) {
    const last = chatMessages[chatMessages.length - 1];
    if (last && last.role === msg.role) {
      last.content += '\n\n' + msg.content;
    } else {
      chatMessages.push({ ...msg });
    }
  }

  try {
    const stream = await client.chat.completions.create({
      model: 'sonar-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        ...chatMessages,
      ],
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            // Perplexity returns citations on the first chunk
            const citations = (chunk as any).citations as string[] | undefined;
            if (citations && citations.length > 0) {
              const event = `data: ${JSON.stringify({ type: 'citations', citations })}\n\n`;
              controller.enqueue(encoder.encode(event));
            }

            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              const event = `data: ${JSON.stringify({ type: 'text-delta', delta })}\n\n`;
              controller.enqueue(encoder.encode(event));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          console.error('Chat stream error:', err);
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('Chat API error:', err);
    return NextResponse.json(
      { error: 'Failed to get response from Perplexity' },
      { status: 502 }
    );
  }
}
