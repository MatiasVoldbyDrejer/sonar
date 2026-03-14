import OpenAI from 'openai';
import { withRetry } from '@/lib/resilience';

const client = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY || '',
  baseURL: 'https://api.perplexity.ai',
});

interface AnalysisResult {
  content: string;
  citations: string[];
}

export async function queryPerplexity(prompt: string): Promise<AnalysisResult> {
  if (!process.env.PERPLEXITY_API_KEY) {
    return {
      content: '*Perplexity API key not configured. Add PERPLEXITY_API_KEY to .env.local to enable AI analysis.*',
      citations: [],
    };
  }

  try {
    const response = await withRetry(
      () => client.chat.completions.create({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'You are a professional financial analyst. Provide accurate, well-sourced analysis. Use markdown formatting. Be concise but thorough.',
          },
          { role: 'user', content: prompt },
        ],
        // @ts-expect-error Perplexity-specific parameters
        search_domain_filter: [
          'reuters.com', 'bloomberg.com', 'ft.com', 'wsj.com',
          'cnbc.com', 'marketwatch.com', 'seekingalpha.com',
          'finance.yahoo.com', 'morningstar.com', 'investing.com',
        ],
        search_recency_filter: 'week',
      }),
      { retries: 1, timeout: 30_000 }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = response as any;
    const message = res.choices?.[0]?.message;
    const content = message?.content || 'No analysis available.';
    const citations = (res.citations as string[]) || [];

    return { content, citations };
  } catch {
    return { content: '*Analysis temporarily unavailable.*', citations: [] };
  }
}
