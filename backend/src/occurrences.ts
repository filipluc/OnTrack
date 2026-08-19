import { pool } from "./db.js";

export interface TaskRow {
  id: number;
  owner_id: number;
  title: string;
  category: string;
  recurrence: "none" | "daily" | "weekly";
  days_of_week: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  created_by: number;
  starts_on: string | null;
  ends_on: string | null;
  remind_minutes_before: number | null;
}

export interface Occurrence {
  id: number;
  title: string;
  category: string;
  recurrence: "none" | "daily" | "weekly";
  startTime: string | null;
  endTime: string | null;
  overridden: boolean;
  date: string;
  status: string;
  homeworkAssigned: boolean;
  homeworkDue: boolean;
  homeworkDone: boolean;
  note: string | null;
  endsOn: string | null;
  remindMinutesBefore: number | null;
}

export function datesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const current = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** True if `date` falls within a recurring task's generation window (irrelevant for one-off tasks). */
export function withinRecurrenceWindow(task: TaskRow, date: string): boolean {
  if (!task.starts_on) return false;
  if (date < task.starts_on) return false;
  if (task.ends_on && date > task.ends_on) return false;
  return true;
}

/** Expands every task a user owns into concrete per-date occurrences over [from, to], with per-date state merged in. */
export async function getOccurrences(userId: number, from: string, to: string): Promise<Occurrence[]> {
  const tasksResult = await pool.query<TaskRow>("SELECT * FROM tasks WHERE owner_id = $1", [userId]);
  const tasks = tasksResult.rows;
  const completionsResult = await pool.query<{
    task_id: number;
    date: string;
    status: string;
    homework_assigned: boolean;
    homework_due: boolean;
    homework_done: boolean;
    note: string | null;
    override_start_time: string | null;
    override_end_time: string | null;
    override_title: string | null;
    override_category: string | null;
  }>(
    `SELECT task_id, date, status, homework_assigned, homework_due, homework_done, note,
            override_start_time, override_end_time, override_title, override_category
     FROM task_completions
     WHERE task_id IN (SELECT id FROM tasks WHERE owner_id = $1) AND date BETWEEN $2 AND $3`,
    [userId, from, to]
  );
  const completionMap = new Map(completionsResult.rows.map((c) => [`${c.task_id}:${c.date}`, c]));

  const dates = datesInRange(from, to);
  const occurrences: Occurrence[] = [];
  for (const date of dates) {
    const dow = new Date(date + "T00:00:00Z").getUTCDay();
    for (const task of tasks) {
      const occurs =
        (task.recurrence === "none" && task.date === date) ||
        (task.recurrence === "daily" && withinRecurrenceWindow(task, date)) ||
        (task.recurrence === "weekly" &&
          withinRecurrenceWindow(task, date) &&
          (task.days_of_week ?? "").split(",").map(Number).includes(dow));
      if (!occurs) continue;
      const completion = completionMap.get(`${task.id}:${date}`);
      if (completion?.status === "skipped") continue;
      occurrences.push({
        id: task.id,
        title: completion?.override_title ?? task.title,
        category: completion?.override_category ?? task.category,
        recurrence: task.recurrence,
        startTime: completion?.override_start_time ?? task.start_time,
        endTime: completion?.override_end_time ?? task.end_time,
        overridden: Boolean(
          completion?.override_start_time ||
            completion?.override_end_time ||
            completion?.override_title ||
            completion?.override_category
        ),
        date,
        status: completion?.status ?? "not_done",
        homeworkAssigned: completion?.homework_assigned ?? false,
        homeworkDue: completion?.homework_due ?? false,
        homeworkDone: completion?.homework_done ?? false,
        note: completion?.note ?? null,
        endsOn: task.ends_on,
        remindMinutesBefore: task.remind_minutes_before,
      });
    }
  }

  return occurrences;
}
