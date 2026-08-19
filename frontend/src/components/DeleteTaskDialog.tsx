import type { Occurrence } from "../api";
import { useEscapeKey } from "../useEscapeKey";

export default function DeleteTaskDialog({
  occurrence,
  onCancel,
  onDeleteOne,
  onDeleteAll,
}: {
  occurrence: Occurrence;
  onCancel: () => void;
  onDeleteOne: () => void;
  onDeleteAll: () => void;
}) {
  const isRecurring = occurrence.recurrence !== "none";
  useEscapeKey(onCancel);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Delete task</h2>
        {isRecurring ? (
          <>
            <p>“{occurrence.title}” repeats. What would you like to delete?</p>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={onCancel}>
                Cancel
              </button>
              <button type="button" className="secondary" onClick={onDeleteOne}>
                Only this day
              </button>
              <button type="button" className="danger" onClick={onDeleteAll}>
                All occurrences
              </button>
            </div>
          </>
        ) : (
          <>
            <p>Delete “{occurrence.title}”? This can't be undone.</p>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={onCancel}>
                Cancel
              </button>
              <button type="button" className="danger" onClick={onDeleteAll}>
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
