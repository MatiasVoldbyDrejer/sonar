import { NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';
import {
  getBotToken,
  getBotInfo,
  createLinkCode,
  ensureWebhook,
} from '@/lib/telegram';

export async function GET() {
  const token = getBotToken();
  const chatId = getSetting('telegram_chat_id');

  if (!token) {
    return NextResponse.json({ connected: false, botConfigured: false });
  }

  if (chatId) {
    return NextResponse.json({ connected: true, botConfigured: true, chatId });
  }

  return NextResponse.json({ connected: false, botConfigured: true });
}

export async function POST(req: Request) {
  const token = getBotToken();
  if (!token) {
    return NextResponse.json(
      { error: 'TELEGRAM_BOT_TOKEN not configured' },
      { status: 400 }
    );
  }

  try {
    // Register webhook if a public base URL is available
    const body = await req.json().catch(() => ({}));
    const webhookBaseUrl =
      (body as Record<string, string>).webhookUrl ||
      process.env.WEBHOOK_BASE_URL ||
      null;

    if (webhookBaseUrl) {
      await ensureWebhook(webhookBaseUrl);
    }

    // Get bot username for deep link
    const bot = await getBotInfo();
    const code = createLinkCode();

    return NextResponse.json({
      url: `https://t.me/${bot.username}?start=${code}`,
    });
  } catch (err) {
    console.error('[telegram-settings] Error:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const db = await import('@/lib/db');
  // Remove chat ID from settings
  db.getDb().prepare("DELETE FROM settings WHERE key = 'telegram_chat_id'").run();

  return NextResponse.json({ connected: false });
}
