import { useState, type FormEvent } from "react";
import { updateOccurrence, type Category, type Occurrence } from "../api";
import { CATEGORIES, CUSTOM_OPTION, FIXED_TITLES } from "./TaskForm";
import { useEscapeKey } from "../useEscapeKey";

/** "Edit only this day" — title/category/time for a single occurrence, leaving the rest of the recurring series alone. */
export default function EditOccurrenceForm({
  occurrence,
  onDone,
  onCancel,
}: {
  occurrence: Occurrence;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<Category>(occurrence.category);
  const initialList = FIXED_TITLES[occurrence.category];
  const [titleChoice, setTitleChoice] = useState<string>(
    initialList.includes(occurrence.title) ? occurrence.title : CUSTOM_OPTION
  );
  const [customTitle, setCustomTitle] = useState(initialList.includes(occurrence.title) ? "" : occurrence.title);
  const [startTime, setStartTime] = useState(occurrence.startTime ?? "");
  const [endTime, setEndTime] = useState(occurrence.endTime ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEscapeKey(onCancel);

  const fixedTitles = FIXED_TITLES[category];
  const isCustom = fixedTitles.length === 0 || titleChoice === CUSTOM_OPTION;

  function handleCategoryChange(next: Category) {
    setCategory(next);
    const list = FIXED_TITLES[next];
    setTitleChoice(list.length > 0 ? list[0] : CUSTOM_OPTION);
    setCustomTitle("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
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
      await updateOccurrence(occurrence.id, occurrence.date, { title, category, startTime, endTime });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>Edit this day only</h2>
        <p className="subtitle">Other occurrences of this task aren't affected.</p>
        {error && <p className="error">{error}</p>}

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

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
