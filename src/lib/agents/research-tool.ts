import { tool } from 'ai';
import { generateText } from 'ai';
import { perplexity } from '@ai-sdk/perplexity';
import { z } from 'zod';

export const researchTool = tool({
  description:
    'Search for current financial news, market data, analyst opinions, and real-time information from trusted financial sources.',
  inputSchema: z.object({
    query: z.string().describe('The research query to search for'),
    recency: z
      .enum(['day', 'week', 'month'])
      .optional()
      .describe('How recent the results should be. Defaults to week.'),
  }),
  execute: async ({ query, recency }) => {
    const result = await generateText({
      model: perplexity('sonar-pro'),
      system: `You are a financial research assistant. Your ONLY job is to find and return accurate, current financial information from trusted sources.

ALWAYS:
- Return factual, sourced information with specific numbers and dates
- Attribute claims to their sources
- Focus precisely on the query asked — do not add tangential information
- Include relevant data points: prices, percentages, dates, analyst names

NEVER:
- Provide investment advice or recommendations
- Add opinions or editorializing
- Speculate beyond what sources report
- Include disclaimers

Return findings as a concise, structured research brief.`,
      prompt: query,
      providerOptions: {
        perplexity: {
          search_domain_filter: [
            'reuters.com',
            'bloomberg.com',
            'ft.com',
            'wsj.com',
            'cnbc.com',
            'marketwatch.com',
            'seekingalpha.com',
            'finance.yahoo.com',
            'morningstar.com',
            'investing.com',
          ],
          search_recency_filter: recency ?? 'week',
        },
      },
    });

    const citations: string[] =
      (result.providerMetadata?.perplexity?.citations as string[]) ?? [];

    return { content: result.text, citations };
  },
});
