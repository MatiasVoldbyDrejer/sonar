import { NextRequest, NextResponse } from 'next/server';
import { getRecurringTaskById, updateRecurringTask, deleteRecurringTask } from '@/lib/recurring-tasks-db';
import { unscheduleTask, rescheduleTask } from '@/lib/scheduler';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = getRecurringTaskById(Number(id));
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(task);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const taskId = Number(id);

  if (body.cronExpression) {
    const cron = await import('node-cron');
    if (!cron.validate(body.cronExpression)) {
      return NextResponse.json({ error: `Invalid cron expression: "${body.cronExpression}"` }, { status: 400 });
    }
  }

  const updated = updateRecurringTask(taskId, body);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  rescheduleTask(updated);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const taskId = Number(id);
  unscheduleTask(taskId);
  const deleted = deleteRecurringTask(taskId);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
