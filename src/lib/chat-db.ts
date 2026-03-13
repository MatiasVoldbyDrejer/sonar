import { getDb } from '@/lib/db';
import type { Chat, ChatSummary } from '@/types';

export function createChat(
  title?: string,
  source: 'user' | 'recurring_task' | 'telegram' = 'user',
  recurringTaskId?: number
): Chat {
  const db = getDb();
  const id = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const date = new Date().toISOString().split('T')[0];

  db.prepare(
    'INSERT INTO chats (id, date, title, messages, source, recurring_task_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, date, title || 'New Thread', '[]', source, recurringTaskId ?? null);

  return {
    id,
    date,
    title: title || 'New Thread',
    messages: [],
    source,
    recurringTaskId: recurringTaskId ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function getChatById(id: string): Chat | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM chats WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? mapChatRow(row) : null;
}

export function findTodayTelegramChat(): Chat | null {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const row = db.prepare(
    "SELECT * FROM chats WHERE source = 'telegram' AND date = ? ORDER BY created_at DESC LIMIT 1"
  ).get(today) as Record<string, unknown> | undefined;
  return row ? mapChatRow(row) : null;
}

export function listChats(source?: 'user' | 'recurring_task' | 'telegram'): ChatSummary[] {
  const db = getDb();
  let sql = 'SELECT id, date, title, messages, source, recurring_task_id, created_at, updated_at FROM chats';
  const params: string[] = [];
  if (source) {
    sql += ' WHERE source = ?';
    params.push(source);
  }
  sql += ' ORDER BY date DESC';
  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];

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
      source: (row.source as 'user' | 'recurring_task' | 'telegram') || 'user',
      recurringTaskId: (row.recurring_task_id as number) ?? null,
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

export function updateChatTitle(id: string, title: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE chats SET title = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(title, id);
}

function mapChatRow(row: Record<string, unknown>): Chat {
  return {
    id: row.id as string,
    date: row.date as string,
    title: row.title as string,
    messages: JSON.parse(row.messages as string),
    source: (row.source as 'user' | 'recurring_task' | 'telegram') || 'user',
    recurringTaskId: (row.recurring_task_id as number) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
