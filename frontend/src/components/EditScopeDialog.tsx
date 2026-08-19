import type { Occurrence } from "../api";
import { useEscapeKey } from "../useEscapeKey";

/** Shown only for a recurring occurrence, before opening the actual edit form — mirrors DeleteTaskDialog's "only this day" vs "all occurrences" choice. */
export default function EditScopeDialog({
  occurrence,
  onCancel,
  onEditOne,
  onEditAll,
}: {
  occurrence: Occurrence;
  onCancel: () => void;
  onEditOne: () => void;
  onEditAll: () => void;
}) {
  useEscapeKey(onCancel);
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Edit task</h2>
        <p>“{occurrence.title}” repeats. What would you like to edit?</p>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="secondary" onClick={onEditOne}>
            Only this day
          </button>
          <button type="button" className="secondary" onClick={onEditAll}>
            All occurrences
          </button>
        </div>
      </div>
    </div>
  );
}
