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

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// In-memory de-dupe only -- reset daily, and lost on a backend restart/redeploy. That means a
// reminder could in rare cases resend after a restart, which is an acceptable trade-off for a
// best-effort reminder rather than pulling in a persistent job queue for this.
const remindedTasks = new Set<string>();
const homeworkNotifiedUsers = new Set<string>();
let lastDate: string | null = null;

async function tick() {
  const { date, minutesOfDay } = localParts();
  if (date !== lastDate) {
    remindedTasks.clear();
    homeworkNotifiedUsers.clear();
    lastDate = date;
  }

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
      const key = `${userId}:${occ.id}:${occ.date}`;
      if (remindedTasks.has(key)) continue;
      const minutesUntilStart = toMinutes(occ.startTime) - minutesOfDay;
      if (minutesUntilStart > 0 && minutesUntilStart <= occ.remindMinutesBefore) {
        remindedTasks.add(key);
        await sendPushToUser(userId, {
          title: `${occ.title} starts soon`,
          body: `Starts at ${occ.startTime}`,
          url: "/",
        });
      }
    }

    const homeworkKey = `${userId}:${date}`;
    if (minutesOfDay >= toMinutes(homeworkCheckTime) && !homeworkNotifiedUsers.has(homeworkKey)) {
      const dueNotDone = occurrences.filter((occ) => occ.category === "school" && occ.homeworkDue && !occ.homeworkDone);
      if (dueNotDone.length > 0) {
        homeworkNotifiedUsers.add(homeworkKey);
        await sendPushToUser(userId, {
          title:
            dueNotDone.length === 1 ? "Homework still due today" : `${dueNotDone.length} homework items still due today`,
          body: dueNotDone.map((o) => o.title).join(", "),
          url: "/agenda",
        });
      }
      // Left unmarked when nothing is due yet, so a class marked "homework given" later
      // in the evening still gets picked up on a later tick, not just at exactly 18:00.
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
