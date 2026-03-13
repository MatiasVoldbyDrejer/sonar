/**
 * UI Block definitions for the agent system prompt.
 *
 * Each block type defines:
 * - name: identifier used in prompts and as the JSON "type" field
 * - tag: XML tag name used to reference this block in prompt directives
 * - description: what the block renders in the chat UI
 * - format: example JSON showing all fields
 * - rules: MUST/NEVER directives for when and how to emit this block
 *
 * Add new block types here — they are automatically included in the system prompt.
 */

interface UIBlockDef {
  name: string;
  tag: string;
  description: string;
  fields: Record<string, string>;
  rules: string[];
}

const blocks: UIBlockDef[] = [
  {
    name: 'recurring-task',
    tag: 'recurring-task-block',
    description: 'Expandable task card with inline edit, pause/resume, run-now, and delete controls.',
    fields: {
      id: 'number — task ID returned by create_recurring_task',
      name: 'string — task name',
      schedule: 'string — cron expression',
      prompt: 'string — the prompt that runs on schedule',
      active: 'boolean — whether the task is currently active',
      timezone: 'string — IANA timezone (e.g. "Europe/Copenhagen")',
      model: 'string — model ID (e.g. "gemini-flash", "sonnet")',
    },
    rules: [
      'MUST emit a <recurring-task-block> immediately after create_recurring_task returns — use all fields from the tool result.',
      'MUST emit one <recurring-task-block> per task when list_recurring_tasks returns results.',
      'MUST emit a <recurring-task-block> after toggle_recurring_task returns, with the updated active state.',
      'NEVER answer or execute the task\'s prompt when creating a recurring task — the prompt is input for the scheduler, not a question to answer now.',
      'MUST choose the model based on task complexity when calling create_recurring_task: gemini-flash for simple summaries, status updates, price checks; sonnet for analysis requiring reasoning, comparisons, recommendations; opus for complex multi-step research, deep portfolio reviews.',
    ],
  },
  {
    name: 'chart',
    tag: 'chart-block',
    description: 'Interactive area chart with optional horizontal annotation lines for support, resistance, and price targets.',
    fields: {
      title: 'string — chart title (e.g. "Novo Nordisk (NOVO-B.CO) — 1Y")',
      currency: 'string — currency code for Y-axis formatting (e.g. "DKK", "USD")',
      dataPoints: 'array of { date: string, close: number } — price/value series, max 50 points',
      annotations: 'array of { value: number, label: string, type: "support" | "resistance" | "target" } — optional horizontal reference lines',
    },
    rules: [
      'MUST emit a <chart-block> when discussing price action, technical levels, or performance and chart data is available from get_chart or get_portfolio_performance.',
      'MUST use the dataPoints array directly from the tool result — do not fabricate data.',
      'NEVER include more than 50 data points.',
      'MUST add annotations for any support, resistance, or price target levels mentioned in your analysis.',
    ],
  },
];

function formatBlockExample(block: UIBlockDef): string {
  const exampleData: Record<string, unknown> = {};
  for (const [key, desc] of Object.entries(block.fields)) {
    if (desc.startsWith('number')) exampleData[key] = 123;
    else if (desc.startsWith('boolean')) exampleData[key] = true;
    else exampleData[key] = `<${key}>`;
  }
  return JSON.stringify({ type: block.name, data: exampleData });
}

/**
 * Builds the <ui_blocks> system prompt section from the block registry.
 * Injected into the agent system prompt alongside other dynamic sections.
 */
export function buildUIBlocksPrompt(): string {
  const blockSections = blocks.map(block => {
    const fieldDocs = Object.entries(block.fields)
      .map(([key, desc]) => `  - \`${key}\`: ${desc}`)
      .join('\n');

    const rules = block.rules
      .map(r => `- ${r}`)
      .join('\n');

    return `<${block.tag}>
**${block.name}** — ${block.description}

Fields:
${fieldDocs}

Format:
\`\`\`sonar-ui
${formatBlockExample(block)}
\`\`\`

${rules}
</${block.tag}>`;
  }).join('\n\n');

  return `<ui_blocks>
You can embed interactive UI elements in your responses using fenced code blocks
with the language \`sonar-ui\`. These render as rich, interactive cards in the web chat.
They are NOT rendered in Telegram — Telegram receives plain text only.

IMPORTANT: When a rule below says MUST emit a block, you MUST include the fenced
code block in your response. The block replaces verbose text confirmations — do not
repeat the block's content as prose.

You have the following ui blocks available:
${blockSections}
</ui_blocks>`;
}
