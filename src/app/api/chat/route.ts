import { streamText, convertToModelMessages } from 'ai';
import { getMainAgentConfig } from '@/lib/agents/main-agent';
import { getInvestorProfile } from '@/lib/profile';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const profile = getInvestorProfile();
  const config = getMainAgentConfig(profile);

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    ...config,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
