import type { Occurrence } from "../api";

const CATEGORY_LABELS: Record<string, string> = {
  school: "School",
  sport: "Sport",
  routine: "Routine",
  leisure: "Leisure",
  other: "Other",
};

export default function DayView({
  occurrences,
  onToggle,
  onDelete,
}: {
  occurrences: Occurrence[];
  onToggle: (occurrence: Occurrence) => void;
  onDelete: (occurrence: Occurrence) => void;
}) {
  if (occurrences.length === 0) {
    return <p className="empty-state">Nothing scheduled for this day yet.</p>;
  }

  const sorted = [...occurrences].sort((a, b) => (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"));

  return (
    <ul className="task-list">
      {sorted.map((occ) => (
        <li key={`${occ.id}-${occ.date}`} className={`task-item ${occ.status === "done" ? "done" : ""}`}>
          <label className="task-check">
            <input type="checkbox" checked={occ.status === "done"} onChange={() => onToggle(occ)} />
          </label>
          <div className="task-info">
            <span className={`category-badge cat-${occ.category}`}>{CATEGORY_LABELS[occ.category]}</span>
            <span className="task-title">{occ.title}</span>
            {occ.startTime && (
              <span className="task-time">
                {occ.startTime}
                {occ.endTime ? ` – ${occ.endTime}` : ""}
              </span>
            )}
          </div>
          <button className="delete-btn" title="Delete task" onClick={() => onDelete(occ)}>
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
