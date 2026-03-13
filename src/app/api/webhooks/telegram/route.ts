import { NextResponse } from 'next/server';
import { generateText, stepCountIs } from 'ai';
import { getMainAgentConfig } from '@/lib/agents/main-agent';
import { getInvestorProfile } from '@/lib/profile';
import {
  createChat,
  saveChatMessages,
  findTodayTelegramChat,
} from '@/lib/chat-db';
import {
  isTelegramEnabled,
  getChatId,
  sendLongMessage,
  validateAndConsumeLinkCode,
  sendMessage,
  getBotToken,
} from '@/lib/telegram';
import { getSetting, setSetting, createTrace } from '@/lib/db';
import type { ChatMessage } from '@/types';

const TELEGRAM_FORMAT_INSTRUCTION = `

<output_format>
You are responding via Telegram. Format your response for Telegram's text rendering:
- Use *single asterisks* for bold (NOT **double**)
- Use _underscores_ for italic
- Use \`backticks\` for monospace
- NO markdown headings (# or ##) — use *bold text* on its own line instead
- NO markdown links [text](url) — just write the URL plainly
- NO bullet point characters (-, *) — use line breaks and indentation to separate items
- NO tables — use simple line-by-line layouts instead
- NO emojis
- Keep it concise and scannable — this is a mobile screen
- Use blank lines to separate sections
</output_format>`;

// Deduplicate messages by ID (expire after 60s)
const processedMessages = new Map<string, number>();

function deduplicateCleanup() {
  const now = Date.now();
  for (const [id, ts] of processedMessages) {
    if (now - ts > 60_000) processedMessages.delete(id);
  }
}

export async function POST(req: Request) {
  // Verify webhook secret
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
  const expectedSecret = getSetting('telegram_webhook_secret');
  if (!getBotToken()) {
    return NextResponse.json({ error: 'Bot not configured' }, { status: 500 });
  }
  if (expectedSecret && secretHeader !== expectedSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();

  // Fire off async processing
  handleUpdate(body).catch(err =>
    console.error('[telegram] Error processing update:', err)
  );

  return NextResponse.json({ status: 'ok' });
}

async function handleUpdate(update: Record<string, unknown>) {
  const message = update.message as Record<string, unknown> | undefined;
  if (!message) return;

  const chat = message.chat as Record<string, unknown>;
  const chatId = String(chat.id);
  const text = message.text as string | undefined;
  const messageId = String(message.message_id);

  if (!text) return;

  // Handle /start command with link code
  if (text.startsWith('/start')) {
    const parts = text.split(' ');
    const code = parts[1];

    if (!code) {
      // No link code — ignore (prevents random people from linking)
      return;
    }

    if (validateAndConsumeLinkCode(code)) {
      setSetting('telegram_chat_id', chatId);
      await sendMessage(chatId, 'Connected to Sonar.');
    } else {
      await sendMessage(chatId, 'Invalid or expired link code.');
    }
    return;
  }

  // Security: reject if chat ID doesn't match stored chat ID
  const storedChatId = getChatId();
  if (!storedChatId || chatId !== storedChatId) {
    console.warn(`[telegram] Rejected message from unknown chat: ${chatId}`);
    return;
  }

  if (!isTelegramEnabled()) return;

  // Deduplicate
  deduplicateCleanup();
  if (processedMessages.has(messageId)) return;
  processedMessages.set(messageId, Date.now());

  // Find or create today's Telegram chat thread
  let chatThread = findTodayTelegramChat();
  if (!chatThread) {
    const today = new Date().toISOString().split('T')[0];
    chatThread = createChat(`Telegram ${today}`, 'telegram');
  }

  // Load existing messages and append user message
  const existingMessages: ChatMessage[] = chatThread.messages || [];
  const userMessage: ChatMessage = {
    id: `msg_${Date.now()}_user`,
    role: 'user',
    content: text,
    createdAt: new Date().toISOString(),
  };
  existingMessages.push(userMessage);

  // Run agent
  const profile = getInvestorProfile();
  const config = getMainAgentConfig(profile, 'gemini-flash');
  const startTime = Date.now();

  const result = await generateText({
    ...config,
    system: config.system + TELEGRAM_FORMAT_INSTRUCTION,
    stopWhen: stepCountIs(10),
    messages: existingMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });

  // Log trace
  try {
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    createTrace({
      id: traceId,
      chatId: chatThread.id,
      modelId: (result as any).response?.modelId ?? 'gemini-flash',
      prompt: text,
      responseText: result.text,
      steps: result.steps.map((step: any, i: number) => ({
        index: i,
        text: step.text ?? '',
        toolCalls: (step.toolCalls ?? []).map((tc: any) => ({ toolName: tc.toolName, args: tc.args })),
        toolResults: (step.toolResults ?? []).map((tr: any) => ({ toolName: tr.toolName, args: tr.args, result: tr.result })),
        inputTokens: step.usage?.inputTokens ?? 0,
        outputTokens: step.usage?.outputTokens ?? 0,
        modelId: step.response?.modelId ?? 'gemini-flash',
        finishReason: step.finishReason ?? 'unknown',
      })),
      totalInputTokens: result.usage?.inputTokens ?? 0,
      totalOutputTokens: result.usage?.outputTokens ?? 0,
      durationMs: Date.now() - startTime,
      finishReason: result.finishReason ?? 'unknown',
    });
  } catch (e) {
    console.error('Failed to save telegram trace:', e);
  }

  // Append assistant response
  const assistantMessage: ChatMessage = {
    id: `msg_${Date.now()}_assistant`,
    role: 'assistant',
    content: result.text,
    createdAt: new Date().toISOString(),
  };
  existingMessages.push(assistantMessage);

  saveChatMessages(chatThread.id, existingMessages);

  // Send response back to Telegram
  await sendLongMessage(result.text);
}
