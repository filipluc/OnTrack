import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth";
import { getChildren, getTasks, type Category, type Child, type Occurrence } from "../api";
import {
  addDays,
  addMonths,
  addYears,
  endOfMonth,
  endOfYear,
  formatDisplay,
  formatMonthYear,
  formatShortDate,
  getWeekDates,
  startOfMonth,
  startOfYear,
  toISODate,
} from "../date";
import TabBar from "../components/TabBar";

const CATEGORY_LABELS: Record<string, string> = {
  school: "School",
  sport: "Sport",
  routine: "Routine",
  leisure: "Leisure",
  study: "Study",
  other: "Other",
};

type PeriodType = "day" | "week" | "month" | "year" | "custom";

const PERIOD_TABS: { value: PeriodType; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "custom", label: "Custom" },
];

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatHours(minutes: number): string {
  if (minutes <= 0) return "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function getRange(
  periodType: PeriodType,
  refDate: string,
  customFrom: string,
  customTo: string
): { from: string; to: string; label: string } {
  switch (periodType) {
    case "day":
      return { from: refDate, to: refDate, label: formatDisplay(refDate) };
    case "week": {
      const dates = getWeekDates(refDate);
      return { from: dates[0], to: dates[6], label: `${formatShortDate(dates[0])} – ${formatShortDate(dates[6])}` };
    }
    case "month":
      return { from: startOfMonth(refDate), to: endOfMonth(refDate), label: formatMonthYear(refDate) };
    case "year":
      return { from: startOfYear(refDate), to: endOfYear(refDate), label: refDate.slice(0, 4) };
    case "custom":
      return { from: customFrom, to: customTo, label: `${formatShortDate(customFrom)} – ${formatShortDate(customTo)}` };
  }
}

function shiftPeriod(periodType: PeriodType, refDate: string, dir: 1 | -1): string {
  switch (periodType) {
    case "day":
      return addDays(refDate, dir);
    case "week":
      return addDays(refDate, dir * 7);
    case "month":
      return addMonths(refDate, dir);
    case "year":
      return addYears(refDate, dir);
    case "custom":
      return refDate;
  }
}

interface TaskAgg {
  title: string;
  scheduledMin: number;
  doneMin: number;
}

interface CategoryAgg {
  category: Category;
  scheduledMin: number;
  doneMin: number;
  tasks: TaskAgg[];
}

function aggregate(occurrences: Occurrence[]): { categories: CategoryAgg[]; untimedCount: number } {
  const byCategory = new Map<Category, Map<string, TaskAgg>>();
  let untimedCount = 0;

  for (const occ of occurrences) {
    if (!occ.startTime || !occ.endTime) {
      untimedCount++;
      continue;
    }
    const duration = toMinutes(occ.endTime) - toMinutes(occ.startTime);
    if (duration <= 0) continue;

    if (!byCategory.has(occ.category)) byCategory.set(occ.category, new Map());
    const tasks = byCategory.get(occ.category)!;
    if (!tasks.has(occ.title)) tasks.set(occ.title, { title: occ.title, scheduledMin: 0, doneMin: 0 });
    const t = tasks.get(occ.title)!;
    t.scheduledMin += duration;
    if (occ.status === "done") t.doneMin += duration;
  }

  const categories: CategoryAgg[] = [];
  for (const [category, tasks] of byCategory) {
    const taskList = Array.from(tasks.values()).sort((a, b) => b.scheduledMin - a.scheduledMin);
    categories.push({
      category,
      scheduledMin: taskList.reduce((s, t) => s + t.scheduledMin, 0),
      doneMin: taskList.reduce((s, t) => s + t.doneMin, 0),
      tasks: taskList,
    });
  }
  categories.sort((a, b) => b.scheduledMin - a.scheduledMin);
  return { categories, untimedCount };
}

interface StreakInfo {
  id: number;
  title: string;
  category: Category;
  streak: number;
}

/** Consecutive completed occurrences of a repeating task, most recent first. Today doesn't break a streak just because it isn't done yet -- there's still time. */
function computeStreaks(occurrences: Occurrence[], todayStr: string): StreakInfo[] {
  const byTask = new Map<number, Occurrence[]>();
  for (const occ of occurrences) {
    if (occ.recurrence === "none") continue;
    if (!byTask.has(occ.id)) byTask.set(occ.id, []);
    byTask.get(occ.id)!.push(occ);
  }

  const result: StreakInfo[] = [];
  for (const [id, occs] of byTask) {
    const sorted = [...occs].sort((a, b) => b.date.localeCompare(a.date));
    let streak = 0;
    for (const occ of sorted) {
      if (occ.date === todayStr && occ.status !== "done") continue;
      if (occ.status === "done") {
        streak++;
      } else {
        break;
      }
    }
    if (streak > 0) {
      result.push({ id, title: occs[0].title, category: occs[0].category, streak });
    }
  }
  result.sort((a, b) => b.streak - a.streak);
  return result;
}

export default function Reports() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [viewedId, setViewedId] = useState<number>(user!.id);
  const [viewedName, setViewedName] = useState<string>(user!.name);
  const [periodType, setPeriodType] = useState<PeriodType>("week");
  const [refDate, setRefDate] = useState(() => toISODate(new Date()));
  const [customFrom, setCustomFrom] = useState(() => toISODate(new Date()));
  const [customTo, setCustomTo] = useState(() => toISODate(new Date()));
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streakOccurrences, setStreakOccurrences] = useState<Occurrence[]>([]);

  const { from, to, label } = getRange(periodType, refDate, customFrom, customTo);

  useEffect(() => {
    if (user!.role !== "parent") return;
    getChildren().then(({ children }) => setChildren(children));
  }, [user]);

  useEffect(() => {
    const todayStr = toISODate(new Date());
    const streakFrom = addDays(todayStr, -100);
    getTasks(viewedId, streakFrom, todayStr)
      .then(({ occurrences }) => setStreakOccurrences(occurrences))
      .catch(() => {});
  }, [viewedId]);

  const streaks = useMemo(() => computeStreaks(streakOccurrences, toISODate(new Date())), [streakOccurrences]);

  useEffect(() => {
    if (from > to) return;
    setLoading(true);
    setError(null);
    getTasks(viewedId, from, to)
      .then(({ occurrences }) => setOccurrences(occurrences))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load report"))
      .finally(() => setLoading(false));
  }, [viewedId, from, to]);

  const { categories, untimedCount } = useMemo(() => aggregate(occurrences), [occurrences]);
  const totalScheduled = categories.reduce((s, c) => s + c.scheduledMin, 0);
  const totalDone = categories.reduce((s, c) => s + c.doneMin, 0);

  function selectSelf() {
    setViewedId(user!.id);
    setViewedName(user!.name);
  }

  function selectChild(child: Child) {
    setViewedId(child.id);
    setViewedName(child.name);
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Reports</h1>
      </header>

      {user!.role === "parent" && (
        <div className="schedule-switcher">
          <button className={viewedId === user!.id ? "chip selected" : "chip"} onClick={selectSelf}>
            My schedule
          </button>
          {children.map((child) => (
            <button
              key={child.id}
              className={viewedId === child.id ? "chip selected" : "chip"}
              onClick={() => selectChild(child)}
            >
              {child.name}
            </button>
          ))}
        </div>
      )}

      {streaks.length > 0 && (
        <div className="streaks-card">
          <h2 className="streaks-heading">🔥 Streaks</h2>
          <ul className="streaks-list">
            {streaks.map((s) => (
              <li key={s.id} className="streaks-row">
                <span className={`category-badge cat-${s.category}`}>{CATEGORY_LABELS[s.category]}</span>
                <span className="streaks-title">{s.title}</span>
                <span className="streaks-count">{s.streak}× in a row</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="period-tabs">
        {PERIOD_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={periodType === tab.value ? "chip selected" : "chip"}
            onClick={() => setPeriodType(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {periodType === "custom" ? (
        <div className="custom-range">
          <label>
            From
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} min={customFrom} />
          </label>
        </div>
      ) : (
        <div className="period-nav">
          <button className="week-nav-btn" onClick={() => setRefDate((d) => shiftPeriod(periodType, d, -1))}>
            ‹
          </button>
          <span className="period-label">{label}</span>
          <button className="week-nav-btn" onClick={() => setRefDate((d) => shiftPeriod(periodType, d, 1))}>
            ›
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {from > to && <p className="error">"From" must be before "To"</p>}

      {loading ? (
        <p className="empty-state">Loading…</p>
      ) : categories.length === 0 ? (
        <p className="empty-state">Nothing scheduled for {viewedName} in this period.</p>
      ) : (
        <>
          <div className="report-grand-total">
            <strong>{viewedName}</strong>
            <span>
              {formatHours(totalScheduled)} scheduled · {formatHours(totalDone)} done
            </span>
          </div>

          <div className="report-list">
            {categories.map((cat) => (
              <div key={cat.category} className="report-card">
                <div className="report-card-header">
                  <span className={`category-badge cat-${cat.category}`}>{CATEGORY_LABELS[cat.category]}</span>
                  <span className="report-card-totals">
                    {formatHours(cat.scheduledMin)} scheduled · {formatHours(cat.doneMin)} done
                  </span>
                </div>
                <ul className="report-task-list">
                  {cat.tasks.map((t) => (
                    <li key={t.title} className="report-task-row">
                      <span className="report-task-title">{t.title}</span>
                      <span className="report-task-totals">
                        {formatHours(t.scheduledMin)} · {formatHours(t.doneMin)} done
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {untimedCount > 0 && (
            <p className="report-note">
              {untimedCount} occurrence{untimedCount === 1 ? "" : "s"} without a time isn't counted above.
            </p>
          )}
        </>
      )}

      <TabBar />
    </div>
  );
}
