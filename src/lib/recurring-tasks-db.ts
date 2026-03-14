import { getDb } from '@/lib/db';
import type { RecurringTask } from '@/types';
import { DEFAULT_MODEL } from '@/lib/constants';

function mapRow(row: Record<string, unknown>): RecurringTask {
  return {
    id: row.id as number,
    name: row.name as string,
    prompt: row.prompt as string,
    cronExpression: row.cron_expression as string,
    timezone: row.timezone as string,
    active: Boolean(row.active),
    lastRunAt: (row.last_run_at as string) ?? null,
    lastChatId: (row.last_chat_id as string) ?? null,
    model: (row.model as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createRecurringTask(
  name: string,
  prompt: string,
  cronExpression: string,
  timezone: string = 'Europe/Copenhagen',
  model: string = DEFAULT_MODEL
): RecurringTask {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO recurring_tasks (name, prompt, cron_expression, timezone, model) VALUES (?, ?, ?, ?, ?)'
  ).run(name, prompt, cronExpression, timezone, model);

  return getRecurringTaskById(result.lastInsertRowid as number)!;
}

export function getRecurringTaskById(id: number): RecurringTask | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM recurring_tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

export function listRecurringTasks(): RecurringTask[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM recurring_tasks ORDER BY created_at DESC').all() as Record<string, unknown>[];
  return rows.map(mapRow);
}

export function updateRecurringTask(
  id: number,
  updates: Partial<Pick<RecurringTask, 'name' | 'prompt' | 'cronExpression' | 'timezone' | 'active' | 'model'>>
): RecurringTask | null {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.prompt !== undefined) { fields.push('prompt = ?'); values.push(updates.prompt); }
  if (updates.cronExpression !== undefined) { fields.push('cron_expression = ?'); values.push(updates.cronExpression); }
  if (updates.timezone !== undefined) { fields.push('timezone = ?'); values.push(updates.timezone); }
  if (updates.active !== undefined) { fields.push('active = ?'); values.push(updates.active ? 1 : 0); }
  if (updates.model !== undefined) { fields.push('model = ?'); values.push(updates.model); }

  if (fields.length === 0) return getRecurringTaskById(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE recurring_tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getRecurringTaskById(id);
}

export function deleteRecurringTask(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM recurring_tasks WHERE id = ?').run(id);
  return result.changes > 0;
}

export function markTaskRun(id: number, chatId?: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE recurring_tasks SET last_run_at = datetime('now'), last_chat_id = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(chatId ?? null, id);
}
