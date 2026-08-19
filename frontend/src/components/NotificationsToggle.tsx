import { useEffect, useState } from "react";
import { pushSupported, isPushEnabled, enablePush, disablePush } from "../push";
import { getNotificationSettings, setNotificationSettings } from "../api";

// Plain 24h hour/minute selects instead of <input type="time"> -- the native time picker's
// 12h-vs-24h (and whether AM/PM is even usable) depends on the device's own locale/browser,
// not on this app, and was reported broken (couldn't set AM/PM) on at least one phone.
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, m) => String(m).padStart(2, "0"));

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

  const [hh, mm] = homeworkCheckTime.split(":");

  function handleHourChange(newHour: string) {
    handleHomeworkCheckTimeChange(`${newHour}:${mm}`);
  }

  function handleMinuteChange(newMinute: string) {
    handleHomeworkCheckTimeChange(`${hh}:${newMinute}`);
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
        <div className="homework-check-time" title="Check for unfinished homework and remind at this time">
          Homework check
          <select value={hh} onChange={(e) => handleHourChange(e.target.value)} aria-label="Hour">
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          :
          <select value={mm} onChange={(e) => handleMinuteChange(e.target.value)} aria-label="Minute">
            {MINUTES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}
      {error && <span className="notifications-error">{error}</span>}
    </div>
  );
}
