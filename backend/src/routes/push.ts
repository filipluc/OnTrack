import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, type AuthedRequest } from "../auth.js";
import { VAPID_PUBLIC_KEY } from "../push.js";

export const pushRouter = Router();

pushRouter.use(requireAuth);

pushRouter.get("/public-key", (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

interface PushSubscriptionBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

pushRouter.post("/subscribe", async (req: AuthedRequest, res) => {
  const subscription = req.body?.subscription as PushSubscriptionBody | undefined;
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    res.status(400).json({ error: "A valid push subscription is required" });
    return;
  }

  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [req.user!.id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
  );

  res.status(201).json({ ok: true });
});

pushRouter.post("/unsubscribe", async (req: AuthedRequest, res) => {
  const endpoint = req.body?.endpoint;
  if (typeof endpoint !== "string") {
    res.status(400).json({ error: "endpoint is required" });
    return;
  }

  // Scoped to the caller's own subscriptions -- a user can only remove their own device.
  await pool.query("DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2", [endpoint, req.user!.id]);
  res.json({ ok: true });
});

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

pushRouter.get("/settings", async (req: AuthedRequest, res) => {
  const result = await pool.query<{ homework_check_time: string }>(
    "SELECT homework_check_time FROM users WHERE id = $1",
    [req.user!.id]
  );
  res.json({ homeworkCheckTime: result.rows[0]?.homework_check_time ?? "18:00" });
});

pushRouter.put("/settings", async (req: AuthedRequest, res) => {
  const { homeworkCheckTime } = req.body ?? {};
  if (!TIME_RE.test(homeworkCheckTime)) {
    res.status(400).json({ error: "homeworkCheckTime must be HH:MM" });
    return;
  }
  await pool.query("UPDATE users SET homework_check_time = $1 WHERE id = $2", [homeworkCheckTime, req.user!.id]);
  res.json({ ok: true });
});
