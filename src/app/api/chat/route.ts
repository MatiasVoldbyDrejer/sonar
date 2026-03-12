import { streamText, convertToModelMessages } from 'ai';
import { getMainAgentConfig } from '@/lib/agents/main-agent';
import { loadPositions } from '@/lib/load-positions';
import { getInvestorProfile } from '@/lib/profile';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const [positions, profile] = await Promise.all([
    loadPositions(),
    Promise.resolve(getInvestorProfile()),
  ]);

  const config = getMainAgentConfig(positions, profile);

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    ...config,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
