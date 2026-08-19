import { useEffect, useState, type FormEvent } from "react";
import { addTask, getTask, updateTask, type Category, type Recurrence } from "../api";
import { WEEKDAY_LABELS } from "../date";

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "school", label: "School" },
  { value: "study", label: "Study" },
  { value: "sport", label: "Sport" },
  { value: "routine", label: "Routine" },
  { value: "leisure", label: "Leisure" },
  { value: "other", label: "Other" },
];

export const FIXED_TITLES: Record<Category, string[]> = {
  school: ["Mate", "Romana", "Istorie", "Geografie", "Sport"],
  sport: ["Antrenament fotbal", "Antrenament individual", "Antrenament Coerver", "Sport complementar", "Meci fotbal", "Turneu"],
  routine: ["Spalat pe dinti", "Pregatit ghiozdan"],
  leisure: ["TV", "PS"],
  study: ["Teme scoala", "Extra Mate/Romana", "Extra Engleza", "Duolingo", "Citit"],
  other: [],
};

export const CUSTOM_OPTION = "__custom__";

export default function TaskForm({
  ownerId,
  defaultDate,
  editTaskId,
  onDone,
  onCancel,
}: {
  ownerId: number;
  defaultDate: string;
  editTaskId?: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(editTaskId !== undefined);
  const [category, setCategory] = useState<Category>("school");
  const [titleChoice, setTitleChoice] = useState<string>(FIXED_TITLES.school[0]);
  const [customTitle, setCustomTitle] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [date, setDate] = useState(defaultDate);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editTaskId === undefined) return;
    getTask(editTaskId)
      .then((task) => {
        setCategory(task.category);
        const list = FIXED_TITLES[task.category];
        if (list.includes(task.title)) {
          setTitleChoice(task.title);
        } else {
          setTitleChoice(CUSTOM_OPTION);
          setCustomTitle(task.title);
        }
        setRecurrence(task.recurrence);
        setDate(task.date ?? defaultDate);
        setDaysOfWeek(task.daysOfWeek);
        setStartTime(task.startTime ?? "");
        setEndTime(task.endTime ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load task"))
      .finally(() => setLoading(false));
  }, [editTaskId, defaultDate]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const fixedTitles = FIXED_TITLES[category];
  const isCustom = fixedTitles.length === 0 || titleChoice === CUSTOM_OPTION;

  function handleCategoryChange(next: Category) {
    setCategory(next);
    const list = FIXED_TITLES[next];
    setTitleChoice(list.length > 0 ? list[0] : CUSTOM_OPTION);
    setCustomTitle("");
  }

  function toggleDay(day: number) {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (recurrence === "weekly" && daysOfWeek.length === 0) {
      setError("Pick at least one day of the week");
      return;
    }
    const title = isCustom ? customTitle.trim() : titleChoice;
    if (!title) {
      setError("Enter a title");
      return;
    }
    if (!startTime || !endTime) {
      setError("Start and end time are required");
      return;
    }
    setSaving(true);
    try {
      const fields = {
        title,
        category,
        recurrence,
        date: recurrence === "none" ? date : undefined,
        daysOfWeek: recurrence === "weekly" ? daysOfWeek : undefined,
        startTime,
        endTime,
      };
      if (editTaskId !== undefined) {
        await updateTask(editTaskId, fields);
      } else {
        await addTask({ ownerId, ...fields });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>{editTaskId !== undefined ? "Edit task" : "Add task"}</h2>
        {error && <p className="error">{error}</p>}
        {loading ? (
          <p className="empty-state">Loading…</p>
        ) : (
          <>
            <label>
              Category
              <select value={category} onChange={(e) => handleCategoryChange(e.target.value as Category)} autoFocus>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            {fixedTitles.length > 0 && (
              <label>
                Title
                <select value={titleChoice} onChange={(e) => setTitleChoice(e.target.value)}>
                  {fixedTitles.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                  <option value={CUSTOM_OPTION}>Other…</option>
                </select>
              </label>
            )}

            {isCustom && (
              <label>
                {fixedTitles.length > 0 ? "Custom title" : "Title"}
                <input type="text" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} required />
              </label>
            )}

            <label>
              Repeats
              <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
                <option value="none">Just once</option>
                <option value="daily">Every day</option>
                <option value="weekly">Certain days each week</option>
              </select>
            </label>

            {recurrence === "none" && (
              <label>
                Date
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </label>
            )}

            {recurrence === "weekly" && (
              <div className="day-picker">
                {WEEKDAY_LABELS.map((label, i) => (
                  <button
                    type="button"
                    key={label}
                    className={daysOfWeek.includes(i) ? "day-chip selected" : "day-chip"}
                    onClick={() => toggleDay(i)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div className="time-row">
              <label>
                Start time
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              </label>
              <label>
                End time
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
              </label>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={saving || loading}>
            {saving ? "Saving…" : editTaskId !== undefined ? "Save" : "Add task"}
          </button>
        </div>
      </form>
    </div>
  );
}
