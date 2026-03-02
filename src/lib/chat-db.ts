import { getDb } from '@/lib/db';
import type { Chat, ChatSummary } from '@/types';

function todayId(): string {
  const date = new Date().toISOString().split('T')[0];
  return `chat_${date}`;
}

function todayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function getOrCreateTodayChat(): Chat {
  const db = getDb();
  const id = todayId();
  const date = todayDate();

  const existing = db.prepare('SELECT * FROM chats WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (existing) {
    return mapChatRow(existing);
  }

  db.prepare(
    'INSERT INTO chats (id, date, title, messages) VALUES (?, ?, ?, ?)'
  ).run(id, date, 'Daily Analysis', '[]');

  return {
    id,
    date,
    title: 'Daily Analysis',
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
    'SELECT id, date, title, created_at, updated_at FROM chats ORDER BY date DESC'
  ).all() as Record<string, unknown>[];

  return rows.map(row => ({
    id: row.id as string,
    date: row.date as string,
    title: row.title as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));
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
