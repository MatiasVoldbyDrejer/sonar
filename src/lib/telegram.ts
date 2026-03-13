import { getSetting, setSetting, getDb } from '@/lib/db';
import crypto from 'crypto';

// ─── Bot token & chat ID ────────────────────────────────────────────

export function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN ?? null;
}

export function getChatId(): string | null {
  return getSetting('telegram_chat_id');
}

export function isTelegramEnabled(): boolean {
  return !!(getBotToken() && getChatId());
}

// ─── Telegram Bot API helpers ───────────────────────────────────────

async function telegramApi(method: string, body?: Record<string, unknown>): Promise<unknown> {
  const token = getBotToken();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set');

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error (${method}): ${JSON.stringify(data)}`);
  }
  return data.result;
}

// ─── Messaging ──────────────────────────────────────────────────────

export async function sendMessage(chatId: string, text: string): Promise<void> {
  await telegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  });
}

export function convertMarkdownToTelegram(md: string): string {
  let text = md;
  // Strip {{TICKER|ISIN}} patterns → TICKER
  text = text.replace(/\{\{([^|}]+)\|[^}]+\}\}/g, '$1');
  // Headings → bold
  text = text.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');
  // **bold** → *bold*
  text = text.replace(/\*\*(.+?)\*\*/g, '*$1*');
  return text;
}

export function chunkMessage(text: string, maxLen = 4096): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf('\n\n', maxLen);
    if (splitAt <= 0) splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt <= 0) splitAt = maxLen;

    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

export async function sendLongMessage(text: string): Promise<void> {
  const chatId = getChatId();
  if (!chatId) throw new Error('Telegram chat ID not configured');

  const converted = convertMarkdownToTelegram(text);
  const chunks = chunkMessage(converted);

  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    await sendMessage(chatId, chunks[i]);
  }
}

// ─── Bot info ───────────────────────────────────────────────────────

export async function getBotInfo(): Promise<{ username: string }> {
  const result = await telegramApi('getMe') as { username: string };
  return { username: result.username };
}

// ─── Webhook management ─────────────────────────────────────────────

export async function setWebhook(baseUrl: string): Promise<void> {
  const secret = crypto.randomBytes(32).toString('hex');
  await telegramApi('setWebhook', {
    url: `${baseUrl}/api/webhooks/telegram`,
    secret_token: secret,
  });
  setSetting('telegram_webhook_secret', secret);
  setSetting('telegram_webhook_url', `${baseUrl}/api/webhooks/telegram`);
}

export async function deleteWebhook(): Promise<void> {
  await telegramApi('deleteWebhook');
}

export async function ensureWebhook(baseUrl: string): Promise<void> {
  const currentUrl = getSetting('telegram_webhook_url');
  const expectedUrl = `${baseUrl}/api/webhooks/telegram`;
  if (currentUrl !== expectedUrl) {
    await setWebhook(baseUrl);
  }
}

// ─── Link codes ─────────────────────────────────────────────────────

export function createLinkCode(): string {
  const db = getDb();
  const code = crypto.randomBytes(16).toString('hex');

  // Clean up expired codes (>10min)
  db.prepare("DELETE FROM telegram_link_codes WHERE created_at < datetime('now', '-10 minutes')").run();

  db.prepare('INSERT INTO telegram_link_codes (code) VALUES (?)').run(code);
  return code;
}

export function validateAndConsumeLinkCode(code: string): boolean {
  const db = getDb();
  const row = db.prepare(
    "SELECT code FROM telegram_link_codes WHERE code = ? AND created_at >= datetime('now', '-10 minutes')"
  ).get(code);

  if (!row) return false;

  db.prepare('DELETE FROM telegram_link_codes WHERE code = ?').run(code);
  return true;
}
