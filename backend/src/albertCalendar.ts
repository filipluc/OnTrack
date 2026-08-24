import { pool } from "./db.js";

// Looked up by name rather than a hardcoded id, so this quietly no-ops (instead of crashing
// the calling schedule fetch) on a fresh/test DB that has no such user.
let albertUserId: number | null | undefined;
export async function getAlbertUserId(): Promise<number | null> {
  if (albertUserId !== undefined) return albertUserId;
  const result = await pool.query<{ id: number }>(
    "SELECT id FROM users WHERE role = 'child' AND LOWER(name) = 'albert' LIMIT 1"
  );
  albertUserId = result.rows[0]?.id ?? null;
  return albertUserId;
}

export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export interface CalendarMatch {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  title: string;
}

/**
 * Mirrors matches into Albert's own calendar as one-off "sport" tasks, so his games show up in
 * Schedule/Agenda alongside everything else, not just under More. Matched on
 * (owner, category, date, title) to update the kickoff time in place on re-sync rather than
 * piling up duplicates; never deletes, so a postponed/removed fixture leaves its task behind
 * for a parent to clean up by hand. Shared by every "sync this competition's matches into
 * Albert's calendar" call site (Elite U13, Cupa Stelele Viitorului, ...).
 */
export async function syncAlbertCalendar(matches: CalendarMatch[]): Promise<void> {
  const albertId = await getAlbertUserId();
  if (!albertId) return;

  for (const m of matches) {
    const existing = await pool.query<{ id: number }>(
      "SELECT id FROM tasks WHERE owner_id = $1 AND category = 'sport' AND date = $2 AND title = $3",
      [albertId, m.date, m.title]
    );
    if (existing.rows[0]) {
      await pool.query("UPDATE tasks SET start_time = $1, end_time = $2 WHERE id = $3", [
        m.startTime,
        m.endTime,
        existing.rows[0].id,
      ]);
    } else {
      await pool.query(
        `INSERT INTO tasks (owner_id, title, category, recurrence, date, start_time, end_time, created_by)
         VALUES ($1, $2, 'sport', 'none', $3, $4, $5, $1)`,
        [albertId, m.title, m.date, m.startTime, m.endTime]
      );
    }
  }
}
