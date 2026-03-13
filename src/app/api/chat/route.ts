import { streamText, convertToModelMessages } from 'ai';
import { getMainAgentConfig } from '@/lib/agents/main-agent';
import type { ModelId } from '@/lib/agents/main-agent';
import { getInvestorProfile } from '@/lib/profile';

export async function POST(req: Request) {
  const { messages, model } = await req.json();

  const profile = getInvestorProfile();
  const config = getMainAgentConfig(profile, model as ModelId | undefined);

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    ...config,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
