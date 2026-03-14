import { NextRequest, NextResponse } from 'next/server';
import { listRecurringTasks, createRecurringTask } from '@/lib/recurring-tasks-db';
import { scheduleTask } from '@/lib/scheduler';
import { getSetting } from '@/lib/db';
import { DEFAULT_MODEL } from '@/lib/constants';

export async function GET() {
  const tasks = listRecurringTasks();
  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, prompt, cronExpression } = body;

  if (!name || !prompt || !cronExpression) {
    return NextResponse.json({ error: 'name, prompt, and cronExpression are required' }, { status: 400 });
  }

  const cron = await import('node-cron');
  if (!cron.validate(cronExpression)) {
    return NextResponse.json({ error: `Invalid cron expression: "${cronExpression}"` }, { status: 400 });
  }

  const timezone = body.timezone || getSetting('timezone') || 'Europe/Copenhagen';
  const model = body.model || DEFAULT_MODEL;
  const task = createRecurringTask(name, prompt, cronExpression, timezone, model);
  scheduleTask(task);

  return NextResponse.json(task, { status: 201 });
}
