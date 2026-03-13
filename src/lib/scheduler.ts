import cron, { type ScheduledTask } from 'node-cron';
import { listRecurringTasks, getRecurringTaskById } from '@/lib/recurring-tasks-db';
import { executeRecurringTask } from '@/lib/task-executor';
import type { RecurringTask } from '@/types';

const jobs = new Map<number, ScheduledTask>();
let initialized = false;

export function initScheduler(): void {
  if (initialized) return;
  initialized = true;

  const tasks = listRecurringTasks();
  const active = tasks.filter(t => t.active);
  for (const task of active) {
    scheduleTask(task);
  }
  console.log(`[scheduler] Initialized with ${active.length} active task(s)`);
}

export function scheduleTask(task: RecurringTask): void {
  if (jobs.has(task.id)) return;

  if (!cron.validate(task.cronExpression)) {
    console.error(`[scheduler] Invalid cron expression for task ${task.id}: ${task.cronExpression}`);
    return;
  }

  const job = cron.schedule(task.cronExpression, async () => {
    try {
      await executeRecurringTask(task.id);
    } catch (err) {
      console.error(`[scheduler] Error executing task ${task.id}:`, err);
    }
  }, { timezone: task.timezone });

  jobs.set(task.id, job);
  console.log(`[scheduler] Scheduled task ${task.id} "${task.name}" (${task.cronExpression})`);
}

export function unscheduleTask(taskId: number): void {
  const job = jobs.get(taskId);
  if (job) {
    job.stop();
    jobs.delete(taskId);
    console.log(`[scheduler] Unscheduled task ${taskId}`);
  }
}

export function rescheduleTask(task: RecurringTask): void {
  unscheduleTask(task.id);
  if (task.active) {
    scheduleTask(task);
  }
}

export async function runTaskNow(taskId: number): Promise<void> {
  const task = getRecurringTaskById(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);
  await executeRecurringTask(taskId);
}
