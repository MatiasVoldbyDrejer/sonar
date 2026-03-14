import { streamText, convertToModelMessages } from 'ai';
import { getMainAgentConfig } from '@/lib/agents/main-agent';
import type { ModelId } from '@/lib/agents/main-agent';
import { getInvestorProfile } from '@/lib/profile';
import { createTraceFromResult } from '@/lib/db';

export async function POST(req: Request) {
  const { messages, model, chatId } = await req.json();
  const startTime = Date.now();

  const profile = getInvestorProfile();
  const config = getMainAgentConfig(profile, model as ModelId | undefined);

  const modelMessages = await convertToModelMessages(messages);

  // Extract user prompt (last user message)
  const userPrompt = messages.filter((m: { role: string }) => m.role === 'user').pop()?.parts?.[0]?.text ?? '';

  const result = streamText({
    ...config,
    messages: modelMessages,
    onFinish: async ({ text, finishReason, steps, response }) => {
      try {
        createTraceFromResult({
          chatId: chatId ?? null,
          prompt: userPrompt,
          result: { text, steps, finishReason, response },
          fallbackModelId: model ?? 'unknown',
          startTime,
        });
      } catch (e) {
        console.error('Failed to save trace:', e);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
