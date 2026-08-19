import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, type AuthedRequest } from "../auth.js";
import { type TaskRow, getOccurrences, addDays, addMonths, withinRecurrenceWindow } from "../occurrences.js";

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

/** How far into the future a recurring task's occurrences are generated before it needs re-adding. */
const RECURRENCE_MONTHS = 3;

/** A parent may act on their own account or a linked child's; a child may only act on their own. */
async function canAccessUser(req: AuthedRequest, targetUserId: number): Promise<boolean> {
  const user = req.user!;
  if (user.id === targetUserId) return true;
  if (user.role !== "parent") return false;
  const result = await pool.query("SELECT id FROM users WHERE id = $1 AND parent_id = $2", [
    targetUserId,
    user.id,
  ]);
  return result.rows.length > 0;
}

async function ownerOfTask(taskId: number): Promise<number | undefined> {
  const result = await pool.query<{ owner_id: number }>("SELECT owner_id FROM tasks WHERE id = $1", [taskId]);
  return result.rows[0]?.owner_id;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The next date (after `fromDate`) this task occurs on, or null if it has no future occurrence. */
export function nextOccurrenceDate(task: TaskRow, fromDate: string): string | null {
  if (task.recurrence === "none") return task.date && task.date > fromDate ? task.date : null;
  if (task.recurrence === "daily") {
    const candidate = addDays(fromDate, 1);
    return withinRecurrenceWindow(task, candidate) ? candidate : null;
  }
  if (task.recurrence === "weekly") {
    // "".split(",") is [""], and Number("") is 0 -- filter that out first, or an empty
    // days_of_week would be silently treated as "Sundays only" instead of "never".
    const days = (task.days_of_week ?? "").split(",").filter(Boolean).map(Number);
    if (days.length === 0) return null;
    for (let offset = 1; offset <= 7; offset++) {
      const candidate = addDays(fromDate, offset);
      if (days.includes(new Date(candidate + "T00:00:00Z").getUTCDay()) && withinRecurrenceWindow(task, candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

/**
 * The same subject is often entered as separate same-titled tasks (e.g. Maths on Mondays
 * and a different Maths entry on Thursdays), not one task with multiple days_of_week. So
 * "the next class of this subject" means the soonest occurrence across every task owned by
 * the same person with a matching title, not just this one task's own recurrence.
 */
async function nextOccurrenceOfSubject(
  task: TaskRow,
  fromDate: string
): Promise<{ taskId: number; date: string } | null> {
  const siblingsResult = await pool.query<TaskRow>(
    "SELECT * FROM tasks WHERE owner_id = $1 AND category = $2 AND LOWER(title) = LOWER($3)",
    [task.owner_id, task.category, task.title]
  );

  let best: { taskId: number; date: string } | null = null;
  for (const sibling of siblingsResult.rows) {
    const candidate = nextOccurrenceDate(sibling, fromDate);
    if (candidate && (!best || candidate < best.date)) {
      best = { taskId: sibling.id, date: candidate };
    }
  }
  return best;
}

tasksRouter.get("/", async (req: AuthedRequest, res) => {
  const userId = Number(req.query.userId);
  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");
  if (!userId || !from || !to) {
    res.status(400).json({ error: "userId, from and to are required" });
    return;
  }
  if (!(await canAccessUser(req, userId))) {
    res.status(403).json({ error: "Not allowed to view this schedule" });
    return;
  }

  const occurrences = await getOccurrences(userId, from, to);
  res.json({ occurrences });
});

/** The full task definition (not an occurrence) — used to prefill the edit form. */
tasksRouter.get("/:id", async (req: AuthedRequest, res) => {
  const taskId = Number(req.params.id);
  const result = await pool.query<TaskRow>("SELECT * FROM tasks WHERE id = $1", [taskId]);
  const task = result.rows[0];
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (!(await canAccessUser(req, task.owner_id))) {
    res.status(403).json({ error: "Not allowed to view this task" });
    return;
  }

  res.json({
    id: task.id,
    ownerId: task.owner_id,
    title: task.title,
    category: task.category,
    recurrence: task.recurrence,
    daysOfWeek: task.days_of_week ? task.days_of_week.split(",").map(Number) : [],
    date: task.date,
    startTime: task.start_time,
    endTime: task.end_time,
    remindMinutesBefore: task.remind_minutes_before,
  });
});

/** `undefined`/`null` (no reminder) pass through as null; anything else must be a positive integer. */
export function parseRemindMinutesBefore(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  return undefined;
}

tasksRouter.post("/", async (req: AuthedRequest, res) => {
  const { ownerId, title, category, recurrence, daysOfWeek, date, startTime, endTime, remindMinutesBefore } =
    req.body ?? {};
  if (!ownerId || !title || !category || !recurrence) {
    res.status(400).json({ error: "ownerId, title, category and recurrence are required" });
    return;
  }
  if (!startTime || !endTime) {
    res.status(400).json({ error: "startTime and endTime are required" });
    return;
  }
  const remindMinutes = parseRemindMinutesBefore(remindMinutesBefore);
  if (remindMinutes === undefined) {
    res.status(400).json({ error: "remindMinutesBefore must be a positive integer or null" });
    return;
  }
  if (!(await canAccessUser(req, ownerId))) {
    res.status(403).json({ error: "Not allowed to add tasks for this user" });
    return;
  }

  const startsOn = recurrence === "none" ? null : today();
  const endsOn = startsOn ? addMonths(startsOn, RECURRENCE_MONTHS) : null;

  const result = await pool.query<{ id: number }>(
    `INSERT INTO tasks (owner_id, title, category, recurrence, days_of_week, date, start_time, end_time, created_by, starts_on, ends_on, remind_minutes_before)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
    [
      ownerId,
      title,
      category,
      recurrence,
      Array.isArray(daysOfWeek) ? daysOfWeek.join(",") : null,
      date ?? null,
      startTime ?? null,
      endTime ?? null,
      req.user!.id,
      startsOn,
      endsOn,
      remindMinutes,
    ]
  );

  res.status(201).json({ id: result.rows[0].id });
});

tasksRouter.put("/:id", async (req: AuthedRequest, res) => {
  const taskId = Number(req.params.id);
  const existingResult = await pool.query<TaskRow>("SELECT * FROM tasks WHERE id = $1", [taskId]);
  const existing = existingResult.rows[0];
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (!(await canAccessUser(req, existing.owner_id))) {
    res.status(403).json({ error: "Not allowed to edit this task" });
    return;
  }

  const { title, category, recurrence, daysOfWeek, date, startTime, endTime, remindMinutesBefore } = req.body ?? {};
  if (!title || !category || !recurrence || !startTime || !endTime) {
    res.status(400).json({ error: "title, category, recurrence, startTime and endTime are required" });
    return;
  }
  const remindMinutes = parseRemindMinutesBefore(remindMinutesBefore);
  if (remindMinutes === undefined) {
    res.status(400).json({ error: "remindMinutesBefore must be a positive integer or null" });
    return;
  }

  // Editing doesn't restart an already-recurring task's window; only switching into
  // recurrence from a one-off task (or a task somehow missing its window) starts a fresh one.
  let startsOn = existing.starts_on;
  let endsOn = existing.ends_on;
  if (recurrence === "none") {
    startsOn = null;
    endsOn = null;
  } else if (!startsOn) {
    startsOn = today();
    endsOn = addMonths(startsOn, RECURRENCE_MONTHS);
  }

  await pool.query(
    `UPDATE tasks SET title = $1, category = $2, recurrence = $3, days_of_week = $4, date = $5, start_time = $6, end_time = $7, starts_on = $8, ends_on = $9, remind_minutes_before = $10
     WHERE id = $11`,
    [
      title,
      category,
      recurrence,
      Array.isArray(daysOfWeek) ? daysOfWeek.join(",") : null,
      date ?? null,
      startTime ?? null,
      endTime ?? null,
      startsOn,
      endsOn,
      remindMinutes,
      taskId,
    ]
  );

  res.json({ ok: true });
});

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Lightweight time-only update for drag-to-move / drag-to-resize on the day timeline —
 * avoids requiring every other field like the full PUT does. For a recurring task this
 * changes only the dragged occurrence (an override on that date's completion row), not
 * the whole series — dragging Monday's swim practice shouldn't retime every other Monday.
 * A one-off task has only the one occurrence anyway, so it updates the task row directly.
 */
tasksRouter.post("/:id/time", async (req: AuthedRequest, res) => {
  const taskId = Number(req.params.id);
  const { date, startTime, endTime } = req.body ?? {};
  if (!date || !TIME_RE.test(startTime) || !TIME_RE.test(endTime) || startTime >= endTime) {
    res.status(400).json({ error: "date, startTime and endTime (HH:MM, startTime before endTime) are required" });
    return;
  }

  const taskResult = await pool.query<TaskRow>("SELECT * FROM tasks WHERE id = $1", [taskId]);
  const task = taskResult.rows[0];
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (!(await canAccessUser(req, task.owner_id))) {
    res.status(403).json({ error: "Not allowed to update this task" });
    return;
  }

  if (task.recurrence === "none") {
    await pool.query("UPDATE tasks SET start_time = $1, end_time = $2 WHERE id = $3", [startTime, endTime, taskId]);
  } else {
    await pool.query(
      `INSERT INTO task_completions (task_id, date, status, override_start_time, override_end_time)
       VALUES ($1, $2, 'not_done', $3, $4)
       ON CONFLICT (task_id, date) DO UPDATE SET override_start_time = EXCLUDED.override_start_time, override_end_time = EXCLUDED.override_end_time`,
      [taskId, date, startTime, endTime]
    );
  }

  res.json({ ok: true });
});

const CATEGORIES = ["school", "sport", "routine", "leisure", "study", "other"];

/**
 * "Edit only this day" for a recurring task: title/category/time overrides on a single
 * occurrence's completion row, leaving the series (and every other occurrence) untouched.
 * Unlike PUT /:id, this never touches recurrence/daysOfWeek/date, since those describe the
 * whole series and don't have a per-occurrence meaning.
 */
tasksRouter.post("/:id/occurrence-edit", async (req: AuthedRequest, res) => {
  const taskId = Number(req.params.id);
  const { date, title, category, startTime, endTime } = req.body ?? {};
  if (
    !date ||
    !title ||
    !CATEGORIES.includes(category) ||
    !TIME_RE.test(startTime) ||
    !TIME_RE.test(endTime) ||
    startTime >= endTime
  ) {
    res.status(400).json({
      error: "date, title, a valid category, and startTime/endTime (HH:MM, startTime before endTime) are required",
    });
    return;
  }

  const ownerId = await ownerOfTask(taskId);
  if (!ownerId) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (!(await canAccessUser(req, ownerId))) {
    res.status(403).json({ error: "Not allowed to update this task" });
    return;
  }

  await pool.query(
    `INSERT INTO task_completions
       (task_id, date, status, override_title, override_category, override_start_time, override_end_time)
     VALUES ($1, $2, 'not_done', $3, $4, $5, $6)
     ON CONFLICT (task_id, date) DO UPDATE SET
       override_title = EXCLUDED.override_title,
       override_category = EXCLUDED.override_category,
       override_start_time = EXCLUDED.override_start_time,
       override_end_time = EXCLUDED.override_end_time`,
    [taskId, date, title, category, startTime, endTime]
  );

  res.json({ ok: true });
});

tasksRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const taskId = Number(req.params.id);
  const date = typeof req.query.date === "string" ? req.query.date : undefined;

  const taskResult = await pool.query<{ owner_id: number; recurrence: string }>(
    "SELECT owner_id, recurrence FROM tasks WHERE id = $1",
    [taskId]
  );
  const task = taskResult.rows[0];
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (!(await canAccessUser(req, task.owner_id))) {
    res.status(403).json({ error: "Not allowed to delete this task" });
    return;
  }

  if (date && task.recurrence !== "none") {
    // Skip just this one occurrence, leaving the recurring task and its other dates intact.
    await pool.query(
      `INSERT INTO task_completions (task_id, date, status, completed_at)
       VALUES ($1, $2, 'skipped', NULL)
       ON CONFLICT (task_id, date) DO UPDATE SET status = 'skipped', completed_at = NULL`,
      [taskId, date]
    );
    res.json({ ok: true });
    return;
  }

  await pool.query("DELETE FROM tasks WHERE id = $1", [taskId]);
  res.json({ ok: true });
});

tasksRouter.post("/:id/complete", async (req: AuthedRequest, res) => {
  const taskId = Number(req.params.id);
  const { date, status } = req.body ?? {};
  if (!date || (status !== "done" && status !== "not_done")) {
    res.status(400).json({ error: "date and status ('done' | 'not_done') are required" });
    return;
  }

  const ownerId = await ownerOfTask(taskId);
  if (!ownerId) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (!(await canAccessUser(req, ownerId))) {
    res.status(403).json({ error: "Not allowed to update this task" });
    return;
  }

  await pool.query(
    `INSERT INTO task_completions (task_id, date, status, completed_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (task_id, date) DO UPDATE SET status = EXCLUDED.status, completed_at = EXCLUDED.completed_at`,
    [taskId, date, status, status === "done" ? new Date().toISOString() : null]
  );

  res.json({ ok: true });
});

/** Mark (or unmark) that this occurrence's class gave homework — flags the *next* occurrence of the same subject as due. */
tasksRouter.post("/:id/homework-assigned", async (req: AuthedRequest, res) => {
  const taskId = Number(req.params.id);
  const { date, assigned } = req.body ?? {};
  if (!date || typeof assigned !== "boolean") {
    res.status(400).json({ error: "date and assigned (boolean) are required" });
    return;
  }

  const taskResult = await pool.query<TaskRow>("SELECT * FROM tasks WHERE id = $1", [taskId]);
  const task = taskResult.rows[0];
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (!(await canAccessUser(req, task.owner_id))) {
    res.status(403).json({ error: "Not allowed to update this task" });
    return;
  }

  const next = await nextOccurrenceOfSubject(task, date);
  if (!next) {
    res.status(400).json({ error: "No upcoming class of this subject to attach homework to" });
    return;
  }

  await pool.query(
    `INSERT INTO task_completions (task_id, date, status, homework_assigned)
     VALUES ($1, $2, 'not_done', $3)
     ON CONFLICT (task_id, date) DO UPDATE SET homework_assigned = EXCLUDED.homework_assigned`,
    [taskId, date, assigned]
  );
  await pool.query(
    `INSERT INTO task_completions (task_id, date, status, homework_due, homework_done)
     VALUES ($1, $2, 'not_done', $3, false)
     ON CONFLICT (task_id, date) DO UPDATE SET homework_due = EXCLUDED.homework_due, homework_done = false`,
    [next.taskId, next.date, assigned]
  );

  res.json({ ok: true });
});

/** Mark whether the homework due on this occurrence has been done. */
tasksRouter.post("/:id/homework-done", async (req: AuthedRequest, res) => {
  const taskId = Number(req.params.id);
  const { date, done } = req.body ?? {};
  if (!date || typeof done !== "boolean") {
    res.status(400).json({ error: "date and done (boolean) are required" });
    return;
  }

  const ownerId = await ownerOfTask(taskId);
  if (!ownerId) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (!(await canAccessUser(req, ownerId))) {
    res.status(403).json({ error: "Not allowed to update this task" });
    return;
  }

  await pool.query(
    `INSERT INTO task_completions (task_id, date, status, homework_done)
     VALUES ($1, $2, 'not_done', $3)
     ON CONFLICT (task_id, date) DO UPDATE SET homework_done = EXCLUDED.homework_done`,
    [taskId, date, done]
  );

  res.json({ ok: true });
});

/** Free-text note on a single occurrence (e.g. what was covered at that day's training). */
tasksRouter.post("/:id/note", async (req: AuthedRequest, res) => {
  const taskId = Number(req.params.id);
  const { date, note } = req.body ?? {};
  if (!date || typeof note !== "string") {
    res.status(400).json({ error: "date and note (string) are required" });
    return;
  }

  const ownerId = await ownerOfTask(taskId);
  if (!ownerId) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (!(await canAccessUser(req, ownerId))) {
    res.status(403).json({ error: "Not allowed to update this task" });
    return;
  }

  const trimmed = note.trim();
  await pool.query(
    `INSERT INTO task_completions (task_id, date, status, note)
     VALUES ($1, $2, 'not_done', $3)
     ON CONFLICT (task_id, date) DO UPDATE SET note = EXCLUDED.note`,
    [taskId, date, trimmed || null]
  );

  res.json({ ok: true });
});

/** Push a recurring task's window another RECURRENCE_MONTHS out, so it keeps generating occurrences. */
tasksRouter.post("/:id/extend", async (req: AuthedRequest, res) => {
  const taskId = Number(req.params.id);
  const taskResult = await pool.query<TaskRow>("SELECT * FROM tasks WHERE id = $1", [taskId]);
  const task = taskResult.rows[0];
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (!(await canAccessUser(req, task.owner_id))) {
    res.status(403).json({ error: "Not allowed to update this task" });
    return;
  }
  if (task.recurrence === "none" || !task.ends_on) {
    res.status(400).json({ error: "This task has no recurrence window to extend" });
    return;
  }

  // Extend from whichever is later -- the task's current end, or today -- so a window that
  // already lapsed doesn't get a shorter extension than a fresh one would.
  const base = task.ends_on > today() ? task.ends_on : today();
  const newEndsOn = addMonths(base, RECURRENCE_MONTHS);
  await pool.query("UPDATE tasks SET ends_on = $1 WHERE id = $2", [newEndsOn, taskId]);

  res.json({ ok: true, endsOn: newEndsOn });
});
