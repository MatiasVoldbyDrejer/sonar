import { getDb } from '@/lib/db';
import type { Chat, ChatSummary } from '@/types';

export function createChat(title?: string): Chat {
  const db = getDb();
  const id = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const date = new Date().toISOString().split('T')[0];

  db.prepare(
    'INSERT INTO chats (id, date, title, messages) VALUES (?, ?, ?, ?)'
  ).run(id, date, title || 'New Thread', '[]');

  return {
    id,
    date,
    title: title || 'New Thread',
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function getChatById(id: string): Chat | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM chats WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? mapChatRow(row) : null;
}

export function listChats(): ChatSummary[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT id, date, title, messages, created_at, updated_at FROM chats ORDER BY date DESC'
  ).all() as Record<string, unknown>[];

  return rows.map(row => {
    let preview: string | undefined;
    try {
      const messages = JSON.parse(row.messages as string) as Array<{ role: string; content: string }>;
      const firstAssistant = messages.find(m => m.role === 'assistant');
      if (firstAssistant?.content) {
        preview = firstAssistant.content.slice(0, 150);
      }
    } catch {}

    return {
      id: row.id as string,
      date: row.date as string,
      title: row.title as string,
      preview,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  });
}

export function saveChatMessages(id: string, messages: unknown[]): void {
  const db = getDb();
  db.prepare(
    "UPDATE chats SET messages = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(JSON.stringify(messages), id);
}

function mapChatRow(row: Record<string, unknown>): Chat {
  return {
    id: row.id as string,
    date: row.date as string,
    title: row.title as string,
    messages: JSON.parse(row.messages as string),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
