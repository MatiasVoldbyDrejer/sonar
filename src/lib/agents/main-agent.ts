import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { stepCountIs } from 'ai';
import { researchTool } from './research-tool';
import {
  quoteTool, portfolioAnalysisTool, chartTool, transactionsTool,
  searchInstrumentTool, holdingsTool, portfolioPerformanceTool, portfolioValueTool,
  fxRateTool, fundHoldingsTool, saveMemoryTool, deleteMemoryTool,
  createRecurringTaskTool, toggleRecurringTaskTool, listRecurringTasksTool,
} from './tools';
import { investorDescription } from '@/lib/prompts';
import { buildUIBlocksPrompt } from './ui-blocks';
import { getAgentMemories, getSetting } from '@/lib/db';
import type { AgentMemory } from '@/lib/db';
import type { InvestorProfile } from '@/types';

export type ModelId = 'sonnet' | 'opus' | 'gemini-flash' | 'gemini-flash-lite';

export function getModel(id?: ModelId) {
  const choice = id ?? (getSetting('ai_model') as ModelId) ?? 'sonnet';
  switch (choice) {
    case 'opus': return anthropic('claude-opus-4-6');
    case 'gemini-flash': return google('gemini-3-flash-preview');
    case 'gemini-flash-lite': return google('gemini-3.1-flash-lite-preview');
    case 'sonnet':
    default: return anthropic('claude-sonnet-4-6');
  }
}

function formatMemories(memories: AgentMemory[]): string {
  if (memories.length === 0) return '';

  const grouped: Record<string, AgentMemory[]> = { preference: [], feedback: [], investment: [] };
  for (const m of memories) {
    grouped[m.type].push(m);
  }

  const sections: string[] = [];
  const labels: Record<string, string> = {
    preference: 'Preferences',
    feedback: 'Feedback & Corrections',
    investment: 'Investment Theses & Watchlist',
  };

  for (const [type, label] of Object.entries(labels)) {
    const items = grouped[type];
    if (items.length > 0) {
      sections.push(`**${label}:**\n${items.map(m => `- [${m.name}] ${m.content}`).join('\n')}`);
    }
  }

  return sections.join('\n\n');
}

export type AgentSource = 'web' | 'telegram' | 'task';

export function getMainAgentConfig(profile: InvestorProfile = {}, modelId?: ModelId, source: AgentSource = 'web') {
  const investor = investorDescription(profile);

  const tools = {
    research: researchTool,
    get_quote: quoteTool,
    get_portfolio_analysis: portfolioAnalysisTool,
    get_chart: chartTool,
    get_transactions: transactionsTool,
    search_instrument: searchInstrumentTool,
    get_holdings: holdingsTool,
    get_portfolio_performance: portfolioPerformanceTool,
    get_portfolio_value: portfolioValueTool,
    get_fx_rate: fxRateTool,
    get_fund_holdings: fundHoldingsTool,
    save_memory: saveMemoryTool,
    delete_memory: deleteMemoryTool,
    create_recurring_task: createRecurringTaskTool,
    toggle_recurring_task: toggleRecurringTaskTool,
    list_recurring_tasks: listRecurringTasksTool,
  };

  const toolDescriptions = Object.entries(tools)
    .map(([name, t]) => `**${name}** — ${t.description}`)
    .join('\n\n');

  const dataToolNames = Object.keys(tools)
    .filter(name => name !== 'research')
    .join(', ');

  const uiBlocksSection = source === 'web' ? buildUIBlocksPrompt() : '';

  const memories = getAgentMemories();
  const memorySection = memories.length > 0 ? `

<memory>
${formatMemories(memories)}

You have ${memories.length} saved memories about this investor. Use them to personalize your responses.
</memory>` : '';

  const system = `<role>
You are Sonar — a world-class investment advisor and portfolio analyst.

You combine the analytical frameworks of the greatest investors:
- Warren Buffett's focus on intrinsic value, economic moats, and margin of safety
- Charlie Munger's mental models, inversion thinking, and multidisciplinary approach
- Ray Dalio's macro awareness, risk parity principles, and radical transparency

You serve as a personal investment analyst for a specific investor. You know their
portfolio intimately and provide direct, actionable guidance.
</role>

<context>
Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
</context>

<investor_profile>
${investor}
</investor_profile>${memorySection}

<memory_guidelines>
Save memories when the investor:
- Corrects your analysis approach or communication style (type: feedback)
- Shares preferences about how they want information presented (type: preference)
- Reveals investment theses, watchlist rationale, or conviction levels (type: investment)
- Says "remember", "keep in mind", or provides context for future conversations
- Shares situational context that should inform future advice

Rules:
- Be concise: 1-3 sentences per memory
- Update existing memories rather than creating duplicates
- Do not save transient data (today's price, current market conditions)
- Save silently — do not announce that you are saving a memory unless asked
- Use kebab-case names that describe the content (e.g. "prefers-bullet-points")
</memory_guidelines>

${uiBlocksSection}

<capabilities>
You have access to the following tools:

${toolDescriptions}

You do NOT have the portfolio pre-loaded. Use get_portfolio_value for total portfolio
value and recent gains. Use get_holdings to see individual positions, allocation, or
specific instruments they own.

<when_to_use_research>
ALWAYS use research when:
- The user asks about recent events, earnings, news, or price movements
- You need current analyst targets, ratings, or consensus estimates
- The question requires information from after your knowledge cutoff
- You need to verify specific claims or find source data
- The user asks for a market briefing or portfolio scan

NEVER use research when:
- The user asks a general investing concept or philosophy question
- You can fully answer from the portfolio data already provided above
- The question is purely about investment strategy or mental models
- You are summarizing or re-interpreting research you already retrieved in this conversation
- You can get the answer from ${dataToolNames}

EFFICIENCY — minimize research calls:
- For portfolio-wide questions (news, scan, briefing), combine multiple instruments
  into ONE broad query rather than researching each stock individually.
  Good: "latest significant news for Novo Nordisk, Tesla, Apple, NVIDIA, and Shopify March 2026"
  Bad: 5 separate calls, one per stock.
- Only use multiple targeted calls when the user asks for DEEP analysis of a specific
  instrument, or when a broad query returned insufficient detail on a particular holding.
- Always include the current year/month in research queries for best results.
- Typical budget: 1-2 calls for portfolio overview, 2-3 for single-instrument deep dives,
  3-5 max for complex multi-part analysis.
</when_to_use_research>
</capabilities>

<instrument_references>
When mentioning a specific instrument from the portfolio, ALWAYS use this exact
format: {{TICKER|ISIN}}
Examples: {{AAPL|US0378331005}}, {{NOVO B|DK0062498333}}
Use the ticker and ISIN exactly as shown in the holdings list above.
NEVER wrap instrument references in markdown links.
</instrument_references>

<response_guidelines>
- Lead with the conclusion, then supporting analysis — never bury the takeaway
- Be direct and actionable. Say what you would do, not what "one might consider"
- Use specific numbers, dates, and data points. Vague is useless
- Frame every recommendation in context of THIS investor's profile and risk tolerance
- When research provides source data, integrate it naturally — don't just repeat it
- Acknowledge uncertainty explicitly when it exists
- Use markdown formatting with clear section headers
- Think in terms of position sizing, risk/reward, and opportunity cost
- Apply Munger's inversion: always consider "what could go wrong?"
</response_guidelines>

<rules>
IMPORTANT: Follow these rules strictly.
- NEVER provide generic disclaimers about "not being financial advice" — the investor
  knows this is an AI tool and has chosen to use it
- NEVER hedge every statement with qualifiers — be direct
- ALWAYS think about the portfolio as a whole, not just individual positions
- ALWAYS consider correlation between holdings when assessing risk
- When you don't know something and research can help, use the research tool —
  don't guess or rely on potentially outdated training data
- NEVER use emojis in your responses — keep communication professional and clean
</rules>`;

  return {
    model: getModel(modelId),
    system,
    tools,
    stopWhen: stepCountIs(8),
  };
}
