import { generateText, stepCountIs } from 'ai';
import { getMainAgentConfig } from '@/lib/agents/main-agent';
import { getInvestorProfile } from '@/lib/profile';
import { getRecurringTaskById, markTaskRun } from '@/lib/recurring-tasks-db';
import { isWhatsAppEnabled, getUserPhone, sendLongMessage, sendTemplate } from '@/lib/whatsapp';

const WHATSAPP_FORMAT_INSTRUCTION = `

<output_format>
You are responding via WhatsApp. Format your response for WhatsApp's text rendering:
- Use *single asterisks* for bold (NOT **double**)
- Use _underscores_ for italic
- Use \`backticks\` for monospace
- NO markdown headings (# or ##) — use *bold text* on its own line instead
- NO markdown links — just write the URL plainly
- NO bullet point characters (-, *) — use line breaks and indentation to separate items
- NO tables — use simple line-by-line layouts
- NO emojis
- Keep it concise and scannable — this is a mobile screen
- Use blank lines to separate sections
</output_format>`;

export async function executeRecurringTask(taskId: number): Promise<void> {
  const task = getRecurringTaskById(taskId);
  if (!task) throw new Error(`Recurring task ${taskId} not found`);

  if (!isWhatsAppEnabled() || !getUserPhone()) {
    console.warn(`[recurring-task] WhatsApp not configured, skipping "${task.name}"`);
    markTaskRun(taskId);
    return;
  }

  const profile = getInvestorProfile();
  const config = getMainAgentConfig(profile);

  const result = await generateText({
    ...config,
    system: config.system + WHATSAPP_FORMAT_INSTRUCTION,
    stopWhen: stepCountIs(10),
    messages: [{ role: 'user', content: task.prompt }],
  });

  markTaskRun(taskId);

  console.log(`[recurring-task] Executed "${task.name}" (id=${taskId}), sending to WhatsApp`);

  try {
    await sendTemplate('hello_world', 'en_US');
  } catch (err) {
    console.warn(`[recurring-task] Template send failed (continuing with message):`, err);
  }

  // Brief pause to let the template open the 24h messaging window
  await new Promise(resolve => setTimeout(resolve, 2000));

  const messageText = `*${task.name}*\n\n${result.text}`;
  console.log(`[recurring-task] Sending WhatsApp message (${messageText.length} chars)`);
  await sendLongMessage(messageText);
  console.log(`[recurring-task] WhatsApp message sent successfully`);
}
