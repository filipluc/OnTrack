import { useState } from "react";
import type { Occurrence } from "../api";

const CATEGORY_LABELS: Record<string, string> = {
  school: "School",
  sport: "Sport",
  routine: "Routine",
  leisure: "Leisure",
  study: "Study",
  other: "Other",
};

const SLOT_MINUTES = 30;
const SLOT_PX = 26;
const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 22;

type Handlers = {
  onToggle: (occurrence: Occurrence) => void;
  onEdit: (occurrence: Occurrence) => void;
  onDelete: (occurrence: Occurrence) => void;
  onSetHomeworkAssigned: (occurrence: Occurrence, assigned: boolean) => void;
  onSetHomeworkDone: (occurrence: Occurrence, done: boolean) => void;
};

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatHourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

interface TimedBlock {
  occ: Occurrence;
  startRow: number;
  endRow: number;
  col: number;
}

function effectiveEndMinutes(o: Occurrence): number {
  const start = toMinutes(o.startTime!);
  return Math.max(toMinutes(o.endTime!), start + SLOT_MINUTES);
}

function layoutDay(occurrences: Occurrence[]) {
  const timed = occurrences.filter((o) => o.startTime && o.endTime);
  const untimed = occurrences.filter((o) => !o.startTime || !o.endTime);

  if (timed.length === 0) {
    return { blocks: [] as TimedBlock[], untimed, startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR, columns: 1 };
  }

  const starts = timed.map((o) => toMinutes(o.startTime!));
  const ends = timed.map((o) => effectiveEndMinutes(o));
  const startHour = Math.min(DEFAULT_START_HOUR, Math.floor(Math.min(...starts) / 60));
  const endHour = Math.max(DEFAULT_END_HOUR, Math.ceil(Math.max(...ends) / 60));
  const rangeStartMin = startHour * 60;

  const sorted = [...timed].sort((a, b) => toMinutes(a.startTime!) - toMinutes(b.startTime!));
  const columnEnds: number[] = [];
  const blocks: TimedBlock[] = [];

  for (const occ of sorted) {
    const start = toMinutes(occ.startTime!);
    const end = effectiveEndMinutes(occ);
    let col = columnEnds.findIndex((endMin) => endMin <= start);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(end);
    } else {
      columnEnds[col] = end;
    }
    const startRow = Math.floor((start - rangeStartMin) / SLOT_MINUTES) + 1;
    const endRow = Math.ceil((end - rangeStartMin) / SLOT_MINUTES) + 1;
    blocks.push({ occ, startRow, endRow, col });
  }

  return { blocks, untimed, startHour, endHour, columns: Math.max(columnEnds.length, 1) };
}

function HomeworkAssignedToggle({
  occ,
  onSetHomeworkAssigned,
}: {
  occ: Occurrence;
  onSetHomeworkAssigned: (occurrence: Occurrence, assigned: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={`homework-toggle-btn ${occ.homeworkAssigned ? "active" : ""}`}
      onClick={() => onSetHomeworkAssigned(occ, !occ.homeworkAssigned)}
    >
      {occ.homeworkAssigned ? "✓ Homework given" : "+ Homework given?"}
    </button>
  );
}

function HomeworkDueCheckbox({
  occ,
  onSetHomeworkDone,
  compact,
}: {
  occ: Occurrence;
  onSetHomeworkDone: (occurrence: Occurrence, done: boolean) => void;
  compact?: boolean;
}) {
  return (
    <label
      className={`homework-toggle homework-due ${occ.homeworkDone ? "done" : "not-done"}`}
      title="Homework for today"
    >
      <input type="checkbox" checked={occ.homeworkDone} onChange={() => onSetHomeworkDone(occ, !occ.homeworkDone)} />
      {compact ? "HW" : "Homework for today"}
    </label>
  );
}

function HomeworkControls({
  occ,
  onSetHomeworkAssigned,
  onSetHomeworkDone,
}: {
  occ: Occurrence;
  onSetHomeworkAssigned: (occurrence: Occurrence, assigned: boolean) => void;
  onSetHomeworkDone: (occurrence: Occurrence, done: boolean) => void;
}) {
  return (
    <div className="homework-row">
      <HomeworkAssignedToggle occ={occ} onSetHomeworkAssigned={onSetHomeworkAssigned} />
      {occ.homeworkDue && <HomeworkDueCheckbox occ={occ} onSetHomeworkDone={onSetHomeworkDone} />}
    </div>
  );
}

function TimelineBlock({
  block,
  expanded,
  onToggleExpand,
  handlers,
}: {
  block: TimedBlock;
  expanded: boolean;
  onToggleExpand: () => void;
  handlers: Handlers;
}) {
  const { occ, startRow, endRow, col } = block;
  return (
    <div
      className={`timeline-block cat-border-${occ.category} ${occ.status === "done" ? "done" : ""} ${expanded ? "expanded" : ""}`}
      style={{ gridRow: `${startRow} / ${endRow}`, gridColumn: col + 2 }}
    >
      <div className="timeline-block-main" onClick={onToggleExpand}>
        <input
          type="checkbox"
          checked={occ.status === "done"}
          onClick={(e) => e.stopPropagation()}
          onChange={() => handlers.onToggle(occ)}
        />
        <span className={`category-badge cat-${occ.category} timeline-block-badge`}>
          {CATEGORY_LABELS[occ.category]}
        </span>
        <span className="timeline-block-title">
          {occ.title}
          {occ.category === "school" && occ.homeworkAssigned && (
            <span className="hw-indicator hw-assigned" title="Homework given" />
          )}
        </span>
        {occ.category === "school" && occ.homeworkDue && (
          <div className="timeline-hw-due" onClick={(e) => e.stopPropagation()}>
            <HomeworkDueCheckbox occ={occ} onSetHomeworkDone={handlers.onSetHomeworkDone} compact />
          </div>
        )}
      </div>

      {expanded && (
        <div className="timeline-block-detail" onClick={(e) => e.stopPropagation()}>
          <div className="timeline-detail-header">
            <span className={`category-badge cat-${occ.category}`}>{CATEGORY_LABELS[occ.category]}</span>
            <button type="button" className="timeline-detail-close" onClick={onToggleExpand}>
              ✕
            </button>
          </div>
          <div className="timeline-detail-title">{occ.title}</div>
          <div className="timeline-detail-time">
            {occ.startTime} – {occ.endTime}
          </div>
          <div className="timeline-detail-actions">
            <button type="button" className="edit-btn" title="Edit task" onClick={() => handlers.onEdit(occ)}>
              ✎ Edit
            </button>
            <button type="button" className="delete-btn" title="Delete task" onClick={() => handlers.onDelete(occ)}>
              ✕ Delete
            </button>
          </div>
          {occ.category === "school" && (
            <div className="homework-row">
              <HomeworkAssignedToggle occ={occ} onSetHomeworkAssigned={handlers.onSetHomeworkAssigned} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DayView({ occurrences, onToggle, onEdit, onDelete, onSetHomeworkAssigned, onSetHomeworkDone }: Handlers & { occurrences: Occurrence[] }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const handlers: Handlers = { onToggle, onEdit, onDelete, onSetHomeworkAssigned, onSetHomeworkDone };

  if (occurrences.length === 0) {
    return <p className="empty-state">Nothing scheduled for this day yet.</p>;
  }

  const { blocks, untimed, startHour, endHour, columns } = layoutDay(occurrences);
  const totalSlots = (endHour - startHour) * (60 / SLOT_MINUTES);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  return (
    <div className="day-view">
      {untimed.length > 0 && (
        <ul className="task-list untimed-list">
          {untimed.map((occ) => (
            <li key={`${occ.id}-${occ.date}`} className={`task-item ${occ.status === "done" ? "done" : ""}`}>
              <div className="task-main">
                <label className="task-check">
                  <input type="checkbox" checked={occ.status === "done"} onChange={() => onToggle(occ)} />
                </label>
                <div className="task-info">
                  <span className={`category-badge cat-${occ.category}`}>{CATEGORY_LABELS[occ.category]}</span>
                  <span className="task-title">{occ.title}</span>
                </div>
                <button className="edit-btn" title="Edit task" onClick={() => onEdit(occ)}>
                  ✎
                </button>
                <button className="delete-btn" title="Delete task" onClick={() => onDelete(occ)}>
                  ✕
                </button>
              </div>
              {occ.category === "school" && (
                <HomeworkControls occ={occ} onSetHomeworkAssigned={onSetHomeworkAssigned} onSetHomeworkDone={onSetHomeworkDone} />
              )}
            </li>
          ))}
        </ul>
      )}

      {blocks.length > 0 && (
        <div
          className="day-timeline"
          style={{
            gridTemplateRows: `repeat(${totalSlots}, ${SLOT_PX}px)`,
            gridTemplateColumns: `44px repeat(${columns}, 1fr)`,
          }}
        >
          <div
            className="timeline-grid-lines"
            style={{ gridRow: `1 / span ${totalSlots}`, gridColumn: `2 / span ${columns}` }}
          />
          {hours.map((h) => (
            <div
              key={h}
              className="timeline-hour-label"
              style={{ gridRow: `${(h - startHour) * 2 + 1} / span 2`, gridColumn: 1 }}
            >
              {formatHourLabel(h)}
            </div>
          ))}
          {blocks.map((block) => {
            const key = `${block.occ.id}-${block.occ.date}`;
            return (
              <TimelineBlock
                key={key}
                block={block}
                expanded={expandedKey === key}
                onToggleExpand={() => setExpandedKey((k) => (k === key ? null : key))}
                handlers={handlers}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
