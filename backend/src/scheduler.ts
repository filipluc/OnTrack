import { pool } from "./db.js";
import { getOccurrences } from "./occurrences.js";
import { sendPushToUser, pushConfigured } from "./push.js";

// The family this app was built for is in Romania; task times are stored as plain wall-clock
// strings with no timezone info (same assumption the rest of the app already makes), so "now"
// for scheduling purposes has to be pinned to one timezone rather than the server's (UTC on Render).
const APP_TIMEZONE = "Europe/Bucharest";

function localParts(): { date: string; minutesOfDay: number } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutesOfDay: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Claims a (user, kind, refKey, date) notification slot, persisted in the DB rather than
 * in-memory -- an in-memory de-dupe set is wiped by every backend restart (a Render
 * redeploy, a crash, a local `tsx watch` reload), and this app gets redeployed often
 * enough that that was causing real duplicate pushes, not just a theoretical edge case.
 * Returns true if this call is the one that gets to send (first claim wins); false if
 * something already claimed this slot.
 */
async function tryClaimNotification(userId: number, kind: string, refKey: string, date: string): Promise<boolean> {
  try {
    await pool.query("INSERT INTO sent_notifications (user_id, kind, ref_key, date) VALUES ($1, $2, $3, $4)", [
      userId,
      kind,
      refKey,
      date,
    ]);
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === "23505") return false; // unique_violation -- already claimed
    throw err;
  }
}

async function tick() {
  const { date, minutesOfDay } = localParts();

  const subscribedUsers = await pool.query<{ user_id: number; homework_check_time: string }>(
    `SELECT DISTINCT ps.user_id, u.homework_check_time
     FROM push_subscriptions ps JOIN users u ON u.id = ps.user_id`
  );

  for (const { user_id: userId, homework_check_time: homeworkCheckTime } of subscribedUsers.rows) {
    const occurrences = await getOccurrences(userId, date, date);

    for (const occ of occurrences) {
      // remindMinutesBefore is opt-in per task (null = no reminder for it) -- most tasks
      // shouldn't page the family, only the ones someone explicitly asked to be reminded about.
      if (occ.status === "done" || !occ.startTime || occ.remindMinutesBefore == null) continue;
      const minutesUntilStart = toMinutes(occ.startTime) - minutesOfDay;
      if (minutesUntilStart > 0 && minutesUntilStart <= occ.remindMinutesBefore) {
        if (!(await tryClaimNotification(userId, "reminder", String(occ.id), occ.date))) continue;
        await sendPushToUser(userId, {
          title: `${occ.title} starts soon`,
          body: `Starts at ${occ.startTime}`,
          url: "/",
        });
      }
    }

    if (minutesOfDay >= toMinutes(homeworkCheckTime)) {
      // School homework uses the homeworkDue/homeworkDone flags (see nextOccurrenceOfSubject);
      // Study tasks (extra practice, reading, etc.) never get that flag set -- they're tracked
      // with the plain done/not_done status like any other task, so "still outstanding today"
      // for them just means not done yet.
      const dueNotDone = occurrences.filter(
        (occ) =>
          (occ.category === "school" && occ.homeworkDue && !occ.homeworkDone) ||
          (occ.category === "study" && occ.status !== "done")
      );
      // Only claimed once we're actually about to send -- if nothing's due yet, the slot stays
      // open so a class marked "homework given" later in the evening still gets picked up on
      // a later tick, not just at exactly the configured check time.
      if (dueNotDone.length > 0 && (await tryClaimNotification(userId, "homework", "daily", date))) {
        await sendPushToUser(userId, {
          title:
            dueNotDone.length === 1 ? "Homework still due today" : `${dueNotDone.length} homework items still due today`,
          body: dueNotDone.map((o) => o.title).join(", "),
          url: "/agenda",
        });
      }
    }
  }
}

export function startScheduler() {
  if (!pushConfigured) {
    console.warn("Notification scheduler not started -- VAPID keys are not configured.");
    return;
  }
  // Runs every minute; a 15-minute-before reminder only needs minute-level precision.
  setInterval(() => {
    tick().catch((err) => console.error("Notification scheduler tick failed", err));
  }, 60_000);
}
