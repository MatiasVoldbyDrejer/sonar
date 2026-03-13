import { NextResponse } from 'next/server';
import { generateText, stepCountIs } from 'ai';
import { getMainAgentConfig } from '@/lib/agents/main-agent';
import { getInvestorProfile } from '@/lib/profile';
import {
  createChat,
  saveChatMessages,
  findTodayWhatsAppChat,
} from '@/lib/chat-db';
import {
  isWhatsAppEnabled,
  getUserPhone,
  sendLongMessage,
} from '@/lib/whatsapp';
import type { ChatMessage } from '@/types';

// Deduplicate messages by ID (expire after 60s)
const processedMessages = new Map<string, number>();

function deduplicateCleanup() {
  const now = Date.now();
  for (const [id, ts] of processedMessages) {
    if (now - ts > 60_000) processedMessages.delete(id);
  }
}

// Webhook verification
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return new Response('Forbidden', { status: 403 });
}

// Incoming messages
export async function POST(req: Request) {
  // Always return 200 immediately per Meta's requirements
  // We process the message asynchronously
  const body = await req.json();

  // Fire off async processing
  handleIncomingMessage(body).catch(err =>
    console.error('[whatsapp] Error processing message:', err)
  );

  return NextResponse.json({ status: 'ok' });
}

async function handleIncomingMessage(body: Record<string, unknown>) {
  if (!isWhatsAppEnabled()) return;

  // Extract message from webhook payload
  const entry = (body.entry as Array<Record<string, unknown>>)?.[0];
  const changes = (entry?.changes as Array<Record<string, unknown>>)?.[0];
  const value = changes?.value as Record<string, unknown> | undefined;
  const messages = (value?.messages as Array<Record<string, unknown>>);

  if (!messages?.length) return;

  const msg = messages[0];
  const messageId = msg.id as string;
  const from = msg.from as string;
  const textBody = (msg.text as Record<string, unknown>)?.body as string;

  if (!textBody) return;

  // Security: single-user guard
  const userPhone = getUserPhone();
  if (userPhone && from !== userPhone) {
    console.warn(`[whatsapp] Rejected message from unknown sender: ${from}`);
    return;
  }

  // Deduplicate
  deduplicateCleanup();
  if (processedMessages.has(messageId)) return;
  processedMessages.set(messageId, Date.now());

  // Find or create today's WhatsApp chat thread
  let chat = findTodayWhatsAppChat();
  if (!chat) {
    const today = new Date().toISOString().split('T')[0];
    chat = createChat(`WhatsApp ${today}`, 'whatsapp');
  }

  // Load existing messages and append user message
  const existingMessages: ChatMessage[] = chat.messages || [];
  const userMessage: ChatMessage = {
    id: `msg_${Date.now()}_user`,
    role: 'user',
    content: textBody,
    createdAt: new Date().toISOString(),
  };
  existingMessages.push(userMessage);

  // Run agent
  const profile = getInvestorProfile();
  const config = getMainAgentConfig(profile);

  const result = await generateText({
    ...config,
    stopWhen: stepCountIs(10),
    messages: existingMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });

  // Append assistant response
  const assistantMessage: ChatMessage = {
    id: `msg_${Date.now()}_assistant`,
    role: 'assistant',
    content: result.text,
    createdAt: new Date().toISOString(),
  };
  existingMessages.push(assistantMessage);

  saveChatMessages(chat.id, existingMessages);

  // Send response back to WhatsApp
  await sendLongMessage(result.text);
}
