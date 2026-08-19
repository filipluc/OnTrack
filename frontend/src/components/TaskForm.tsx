import { useEffect, useState, type FormEvent } from "react";
import { addTask, getTask, updateTask, type Category, type Recurrence } from "../api";
import { WEEKDAY_LABELS } from "../date";
import { useEscapeKey } from "../useEscapeKey";
import { CategoryPicker, TitlePicker, TimeSelect, FIXED_TITLES, CUSTOM_OPTION } from "./TaskFormFields";

const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: "none", label: "Just once" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Certain days each week" },
];

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
  const [remind, setRemind] = useState(false);
  // Kept as free-text rather than a clamped number -- clamping on every keystroke made it
  // impossible to clear the field down to empty before typing a new value (deleting the
  // last digit just snapped straight back to 1). Parsed and clamped only on submit.
  const [remindMinutes, setRemindMinutes] = useState("60");
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
        setRemind(task.remindMinutesBefore != null);
        if (task.remindMinutesBefore != null) setRemindMinutes(String(task.remindMinutesBefore));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load task"))
      .finally(() => setLoading(false));
  }, [editTaskId, defaultDate]);

  useEscapeKey(onCancel);

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
    const parsedRemindMinutes = Math.max(1, Math.min(1440, Math.round(Number(remindMinutes)) || 60));
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
        remindMinutesBefore: remind ? parsedRemindMinutes : null,
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
            <CategoryPicker value={category} onChange={handleCategoryChange} />

            <TitlePicker
              category={category}
              titleChoice={titleChoice}
              onTitleChoiceChange={setTitleChoice}
              customTitle={customTitle}
              onCustomTitleChange={setCustomTitle}
            />

            <div className="field">
              <span className="field-label">Repeats</span>
              <div className="day-picker">
                {RECURRENCE_OPTIONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    className={`day-chip ${recurrence === r.value ? "selected" : ""}`}
                    onClick={() => setRecurrence(r.value)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

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
              <TimeSelect label="Start time" value={startTime} onChange={setStartTime} />
              <TimeSelect label="End time" value={endTime} onChange={setEndTime} />
            </div>

            <div className="remind-row">
              <label className="remind-checkbox">
                <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
                🔔 Remind me before this
              </label>
              {remind && (
                <label className="remind-minutes">
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={remindMinutes}
                    onChange={(e) => setRemindMinutes(e.target.value)}
                  />
                  minutes before
                </label>
              )}
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
