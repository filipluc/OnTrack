import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, type AuthedRequest } from "../auth.js";

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

interface TaskRow {
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
}

/** A parent may act on their own account or a linked child's; a child may only act on their own. */
function canAccessUser(req: AuthedRequest, targetUserId: number): boolean {
  const user = req.user!;
  if (user.id === targetUserId) return true;
  if (user.role !== "parent") return false;
  const child = db
    .prepare("SELECT id FROM users WHERE id = ? AND parent_id = ?")
    .get(targetUserId, user.id);
  return !!child;
}

function ownerOfTask(taskId: number): number | undefined {
  const row = db.prepare("SELECT owner_id FROM tasks WHERE id = ?").get(taskId) as
    | { owner_id: number }
    | undefined;
  return row?.owner_id;
}

function datesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const current = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

tasksRouter.get("/", (req: AuthedRequest, res) => {
  const userId = Number(req.query.userId);
  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");
  if (!userId || !from || !to) {
    res.status(400).json({ error: "userId, from and to are required" });
    return;
  }
  if (!canAccessUser(req, userId)) {
    res.status(403).json({ error: "Not allowed to view this schedule" });
    return;
  }

  const tasks = db.prepare("SELECT * FROM tasks WHERE owner_id = ?").all(userId) as TaskRow[];
  const completions = db
    .prepare(
      `SELECT task_id, date, status FROM task_completions
       WHERE task_id IN (SELECT id FROM tasks WHERE owner_id = ?) AND date BETWEEN ? AND ?`
    )
    .all(userId, from, to) as { task_id: number; date: string; status: string }[];
  const completionMap = new Map(completions.map((c) => [`${c.task_id}:${c.date}`, c.status]));

  const dates = datesInRange(from, to);
  const occurrences = [];
  for (const date of dates) {
    const dow = new Date(date + "T00:00:00Z").getUTCDay();
    for (const task of tasks) {
      const occurs =
        (task.recurrence === "none" && task.date === date) ||
        task.recurrence === "daily" ||
        (task.recurrence === "weekly" &&
          (task.days_of_week ?? "").split(",").map(Number).includes(dow));
      if (!occurs) continue;
      occurrences.push({
        id: task.id,
        title: task.title,
        category: task.category,
        recurrence: task.recurrence,
        startTime: task.start_time,
        endTime: task.end_time,
        date,
        status: completionMap.get(`${task.id}:${date}`) ?? "not_done",
      });
    }
  }

  res.json({ occurrences });
});

tasksRouter.post("/", (req: AuthedRequest, res) => {
  const { ownerId, title, category, recurrence, daysOfWeek, date, startTime, endTime } = req.body ?? {};
  if (!ownerId || !title || !category || !recurrence) {
    res.status(400).json({ error: "ownerId, title, category and recurrence are required" });
    return;
  }
  if (!canAccessUser(req, ownerId)) {
    res.status(403).json({ error: "Not allowed to add tasks for this user" });
    return;
  }

  const result = db
    .prepare(
      `INSERT INTO tasks (owner_id, title, category, recurrence, days_of_week, date, start_time, end_time, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      ownerId,
      title,
      category,
      recurrence,
      Array.isArray(daysOfWeek) ? daysOfWeek.join(",") : null,
      date ?? null,
      startTime ?? null,
      endTime ?? null,
      req.user!.id
    );

  res.status(201).json({ id: result.lastInsertRowid });
});

tasksRouter.put("/:id", (req: AuthedRequest, res) => {
  const taskId = Number(req.params.id);
  const ownerId = ownerOfTask(taskId);
  if (!ownerId) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (!canAccessUser(req, ownerId)) {
    res.status(403).json({ error: "Not allowed to edit this task" });
    return;
  }

  const { title, category, recurrence, daysOfWeek, date, startTime, endTime } = req.body ?? {};
  db.prepare(
    `UPDATE tasks SET title = ?, category = ?, recurrence = ?, days_of_week = ?, date = ?, start_time = ?, end_time = ?
     WHERE id = ?`
  ).run(
    title,
    category,
    recurrence,
    Array.isArray(daysOfWeek) ? daysOfWeek.join(",") : null,
    date ?? null,
    startTime ?? null,
    endTime ?? null,
    taskId
  );

  res.json({ ok: true });
});

tasksRouter.delete("/:id", (req: AuthedRequest, res) => {
  const taskId = Number(req.params.id);
  const ownerId = ownerOfTask(taskId);
  if (!ownerId) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (!canAccessUser(req, ownerId)) {
    res.status(403).json({ error: "Not allowed to delete this task" });
    return;
  }

  db.prepare("DELETE FROM tasks WHERE id = ?").run(taskId);
  res.json({ ok: true });
});

tasksRouter.post("/:id/complete", (req: AuthedRequest, res) => {
  const taskId = Number(req.params.id);
  const { date, status } = req.body ?? {};
  if (!date || (status !== "done" && status !== "not_done")) {
    res.status(400).json({ error: "date and status ('done' | 'not_done') are required" });
    return;
  }

  const ownerId = ownerOfTask(taskId);
  if (!ownerId) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (!canAccessUser(req, ownerId)) {
    res.status(403).json({ error: "Not allowed to update this task" });
    return;
  }

  db.prepare(
    `INSERT INTO task_completions (task_id, date, status, completed_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(task_id, date) DO UPDATE SET status = excluded.status, completed_at = excluded.completed_at`
  ).run(taskId, date, status, status === "done" ? new Date().toISOString() : null);

  res.json({ ok: true });
});
