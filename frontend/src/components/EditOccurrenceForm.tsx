import { useState, type FormEvent } from "react";
import { updateOccurrence, type Category, type Occurrence } from "../api";
import { CategoryPicker, TitlePicker, TimeSelect, CUSTOM_OPTION, FIXED_TITLES } from "./TaskFormFields";
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

        <CategoryPicker value={category} onChange={handleCategoryChange} />

        <TitlePicker
          category={category}
          titleChoice={titleChoice}
          onTitleChoiceChange={setTitleChoice}
          customTitle={customTitle}
          onCustomTitleChange={setCustomTitle}
        />

        <div className="time-row">
          <TimeSelect label="Start time" value={startTime} onChange={setStartTime} />
          <TimeSelect label="End time" value={endTime} onChange={setEndTime} />
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
