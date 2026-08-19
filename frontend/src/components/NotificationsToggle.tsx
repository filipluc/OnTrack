import { useEffect, useState } from "react";
import { pushSupported, isPushEnabled, enablePush, disablePush } from "../push";
import { getNotificationSettings, setNotificationSettings } from "../api";

export default function NotificationsToggle() {
  const [supported] = useState(pushSupported);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [homeworkCheckTime, setHomeworkCheckTime] = useState("18:00");

  useEffect(() => {
    if (!supported) return;
    isPushEnabled().then(setEnabled);
  }, [supported]);

  useEffect(() => {
    if (!enabled) return;
    getNotificationSettings()
      .then(({ homeworkCheckTime }) => setHomeworkCheckTime(homeworkCheckTime))
      .catch(() => {});
  }, [enabled]);

  if (!supported) return null;

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
      } else {
        await enablePush();
        setEnabled(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update notifications");
    } finally {
      setBusy(false);
    }
  }

  async function handleHomeworkCheckTimeChange(value: string) {
    setHomeworkCheckTime(value);
    try {
      await setNotificationSettings(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save notification settings");
    }
  }

  return (
    <div className="notifications-toggle">
      <button
        type="button"
        className="theme-toggle-btn"
        title={enabled ? "Turn off notifications" : "Turn on notifications"}
        onClick={toggle}
        disabled={busy}
      >
        {enabled ? "🔔" : "🔕"}
      </button>
      {enabled && (
        <label className="homework-check-time" title="Check for unfinished homework and remind at this time">
          Homework check
          <input
            type="time"
            value={homeworkCheckTime}
            onChange={(e) => handleHomeworkCheckTimeChange(e.target.value)}
          />
        </label>
      )}
      {error && <span className="notifications-error">{error}</span>}
    </div>
  );
}
