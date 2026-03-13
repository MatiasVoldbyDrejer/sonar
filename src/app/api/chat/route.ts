import { streamText, convertToModelMessages } from 'ai';
import { getMainAgentConfig } from '@/lib/agents/main-agent';
import type { ModelId } from '@/lib/agents/main-agent';
import { getInvestorProfile } from '@/lib/profile';
import { createTrace } from '@/lib/db';

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
    onFinish: async ({ text, usage, finishReason, steps, response }) => {
      try {
        const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        createTrace({
          id: traceId,
          chatId: chatId ?? null,
          modelId: response?.modelId ?? model ?? 'unknown',
          prompt: userPrompt,
          responseText: text,
          steps: steps.map((step, i) => ({
            index: i,
            text: step.text,
            toolCalls: step.toolCalls.map(tc => ({ toolName: tc.toolName, args: (tc as any).args })),
            toolResults: step.toolResults.map(tr => ({ toolName: tr.toolName, args: (tr as any).args, result: (tr as any).result })),
            inputTokens: step.usage?.inputTokens ?? 0,
            outputTokens: step.usage?.outputTokens ?? 0,
            modelId: step.response?.modelId ?? model ?? 'unknown',
            finishReason: step.finishReason ?? 'unknown',
          })),
          totalInputTokens: usage?.inputTokens ?? 0,
          totalOutputTokens: usage?.outputTokens ?? 0,
          durationMs: Date.now() - startTime,
          finishReason: finishReason ?? 'unknown',
        });
      } catch (e) {
        console.error('Failed to save trace:', e);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
