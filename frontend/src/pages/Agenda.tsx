import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { getChildren, getTasks, setTaskStatus, type Child, type Occurrence } from "../api";
import { addDays, formatMonthYear, formatShortDate, formatWeekdayShort, getWeekDates, toISODate } from "../date";

const CATEGORY_LABELS: Record<string, string> = {
  school: "School",
  sport: "Sport",
  routine: "Routine",
  leisure: "Leisure",
  study: "Study",
  other: "Other",
};

type FilterMode = "all" | "homework" | "sport";

function matchesFilter(o: Occurrence, mode: FilterMode): boolean {
  if (mode === "homework") return o.category === "school" && Boolean(o.homeworkDue);
  if (mode === "sport") return o.category === "sport";
  return true;
}

export default function Agenda() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [viewedId, setViewedId] = useState<number>(user!.id);
  const [viewedName, setViewedName] = useState<string>(user!.name);
  const [refDate, setRefDate] = useState(() => toISODate(new Date()));
  const [showDone, setShowDone] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekDates = getWeekDates(refDate);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  useEffect(() => {
    if (user!.role !== "parent") return;
    getChildren().then(({ children }) => setChildren(children));
  }, [user]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getTasks(viewedId, weekStart, weekEnd)
      .then(({ occurrences }) => setOccurrences(occurrences))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load agenda"))
      .finally(() => setLoading(false));
  }, [viewedId, weekStart, weekEnd]);

  function selectSelf() {
    setViewedId(user!.id);
    setViewedName(user!.name);
  }

  function selectChild(child: Child) {
    setViewedId(child.id);
    setViewedName(child.name);
  }

  async function handleToggle(occ: Occurrence) {
    const nextStatus = occ.status === "done" ? "not_done" : "done";
    setOccurrences((prev) =>
      prev.map((o) => (o.id === occ.id && o.date === occ.date ? { ...o, status: nextStatus } : o))
    );
    try {
      await setTaskStatus(occ.id, occ.date, nextStatus);
    } catch {
      setOccurrences((prev) =>
        prev.map((o) => (o.id === occ.id && o.date === occ.date ? { ...o, status: occ.status } : o))
      );
    }
  }

  const visible = occurrences
    .filter((o) => showDone || o.status !== "done")
    .filter((o) => matchesFilter(o, filterMode));
  const byDay = weekDates.map((d) => ({
    date: d,
    items: visible.filter((o) => o.date === d).sort((a, b) => (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99")),
  }));
  const daysWithItems = byDay.filter((d) => d.items.length > 0);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <Link to="/" className="secondary back-link">
            ‹ Back
          </Link>
          <h1>Agenda</h1>
        </div>
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

      <div className="period-nav">
        <button className="week-nav-btn" onClick={() => setRefDate((d) => addDays(d, -7))}>
          ‹
        </button>
        <span className="period-label">
          {formatShortDate(weekStart)} – {formatShortDate(weekEnd)}, {formatMonthYear(weekStart)}
        </span>
        <button className="week-nav-btn" onClick={() => setRefDate((d) => addDays(d, 7))}>
          ›
        </button>
      </div>

      <div className="agenda-filters">
        <div className="agenda-filter-chips">
          <button
            type="button"
            className={filterMode === "all" ? "chip selected" : "chip"}
            onClick={() => setFilterMode("all")}
          >
            All
          </button>
          <button
            type="button"
            className={filterMode === "homework" ? "chip selected" : "chip"}
            onClick={() => setFilterMode("homework")}
          >
            📖 Homework
          </button>
          <button
            type="button"
            className={filterMode === "sport" ? "chip selected" : "chip"}
            onClick={() => setFilterMode("sport")}
          >
            ⚽ Sport
          </button>
        </div>
        <label className="agenda-show-done">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Show done too
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty-state">Loading…</p>
      ) : daysWithItems.length === 0 ? (
        <p className="empty-state">
          {filterMode === "homework"
            ? `No homework due for ${viewedName} this week.`
            : filterMode === "sport"
              ? `No sport scheduled for ${viewedName} this week.`
              : showDone
                ? `Nothing scheduled for ${viewedName} this week.`
                : `Nothing left to do for ${viewedName} this week 🎉`}
        </p>
      ) : (
        <div className="agenda-list">
          {daysWithItems.map((day) => (
            <div key={day.date} className="agenda-day">
              <h2 className="agenda-day-heading">
                {formatWeekdayShort(day.date)} {day.date.slice(8, 10)}
              </h2>
              <ul className="agenda-item-list">
                {day.items.map((occ) => (
                  <li key={`${occ.id}-${occ.date}`} className={`agenda-item ${occ.status === "done" ? "done" : ""}`}>
                    <label className="task-check">
                      <input type="checkbox" checked={occ.status === "done"} onChange={() => handleToggle(occ)} />
                    </label>
                    <span className={`category-badge cat-${occ.category}`}>{CATEGORY_LABELS[occ.category]}</span>
                    <span className="agenda-item-title">{occ.title}</span>
                    {occ.startTime && <span className="task-time">{occ.startTime}</span>}
                    {occ.category === "school" && occ.homeworkDue && (
                      <span className={`agenda-hw-tag ${occ.homeworkDone ? "done" : "not-done"}`}>
                        {occ.homeworkDone ? "HW done" : "HW due"}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
