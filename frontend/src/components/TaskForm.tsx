import { useState, type FormEvent } from "react";
import { addTask, type Category, type Recurrence } from "../api";
import { WEEKDAY_LABELS } from "../date";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "school", label: "School" },
  { value: "sport", label: "Sport" },
  { value: "routine", label: "Routine" },
  { value: "leisure", label: "Leisure" },
  { value: "other", label: "Other" },
];

export default function TaskForm({
  ownerId,
  defaultDate,
  onDone,
  onCancel,
}: {
  ownerId: number;
  defaultDate: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("school");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [date, setDate] = useState(defaultDate);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    try {
      await addTask({
        ownerId,
        title,
        category,
        recurrence,
        date: recurrence === "none" ? date : undefined,
        daysOfWeek: recurrence === "weekly" ? daysOfWeek : undefined,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
      });
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
        <h2>Add task</h2>
        {error && <p className="error">{error}</p>}
        <label>
          Title
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </label>
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
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
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label>
            End time
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Add task"}
          </button>
        </div>
      </form>
    </div>
  );
}
