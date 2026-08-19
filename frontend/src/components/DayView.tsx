import { useRef, useState } from "react";
import type { Occurrence } from "../api";

const CATEGORY_LABELS: Record<string, string> = {
  school: "School",
  sport: "Sport",
  routine: "Routine",
  leisure: "Leisure",
  study: "Study",
  other: "Other",
};

// 15-minute grid so drag/resize can snap to quarter/half/full hours.
const SLOT_MINUTES = 15;
const SLOT_PX = 13;
const MIN_BLOCK_MINUTES = 45; // visual minimum height (checkbox/badge/title row + resize handle), independent of a task's real (possibly shorter) duration
const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 22;
const DRAG_THRESHOLD_PX = 4;

type Handlers = {
  onToggle: (occurrence: Occurrence) => void;
  onEdit: (occurrence: Occurrence) => void;
  onDelete: (occurrence: Occurrence) => void;
  onSetHomeworkAssigned: (occurrence: Occurrence, assigned: boolean) => void;
  onSetHomeworkDone: (occurrence: Occurrence, done: boolean) => void;
  onSetTaskTime: (occurrence: Occurrence, startTime: string, endTime: string) => void;
};

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatHourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

interface TimedBlock {
  occ: Occurrence;
  col: number;
}

function effectiveEndMinutes(o: Occurrence): number {
  const start = toMinutes(o.startTime!);
  return Math.max(toMinutes(o.endTime!), start + MIN_BLOCK_MINUTES);
}

function layoutDay(occurrences: Occurrence[]) {
  const timed = occurrences.filter((o) => o.startTime && o.endTime);
  const untimed = occurrences.filter((o) => !o.startTime || !o.endTime);

  if (timed.length === 0) {
    return {
      blocks: [] as TimedBlock[],
      untimed,
      startHour: DEFAULT_START_HOUR,
      endHour: DEFAULT_END_HOUR,
      columns: 1,
    };
  }

  const starts = timed.map((o) => toMinutes(o.startTime!));
  const ends = timed.map((o) => effectiveEndMinutes(o));
  const startHour = Math.min(DEFAULT_START_HOUR, Math.floor(Math.min(...starts) / 60));
  const endHour = Math.max(DEFAULT_END_HOUR, Math.ceil(Math.max(...ends) / 60));

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
    blocks.push({ occ, col });
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

interface DragState {
  mode: "move" | "resize";
  pointerId: number;
  startY: number;
  moved: boolean;
  previewStart: number;
  previewEnd: number;
}

function TimelineBlock({
  block,
  expanded,
  onToggleExpand,
  handlers,
  rangeStartMin,
  rangeEndMin,
}: {
  block: TimedBlock;
  expanded: boolean;
  onToggleExpand: () => void;
  handlers: Handlers;
  rangeStartMin: number;
  rangeEndMin: number;
}) {
  const { occ, col } = block;
  const origStart = toMinutes(occ.startTime!);
  const origEnd = toMinutes(occ.endTime!);
  const blockRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const previewStart = drag ? drag.previewStart : origStart;
  const previewEnd = drag ? drag.previewEnd : origEnd;
  const displayEnd = Math.max(previewEnd, previewStart + MIN_BLOCK_MINUTES);
  const startRow = Math.floor((previewStart - rangeStartMin) / SLOT_MINUTES) + 1;
  const endRow = Math.ceil((displayEnd - rangeStartMin) / SLOT_MINUTES) + 1;

  function snap(minutes: number): number {
    return Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES;
  }

  function startDrag(mode: "move" | "resize", e: React.PointerEvent) {
    blockRef.current?.setPointerCapture(e.pointerId);
    setDrag({ mode, pointerId: e.pointerId, startY: e.clientY, moved: false, previewStart: origStart, previewEnd: origEnd });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const deltaY = e.clientY - drag.startY;
    if (!drag.moved && Math.abs(deltaY) < DRAG_THRESHOLD_PX) return;

    const deltaMinutes = snap((deltaY / SLOT_PX) * SLOT_MINUTES);
    if (drag.mode === "move") {
      const duration = origEnd - origStart;
      const newStart = Math.max(rangeStartMin, Math.min(origStart + deltaMinutes, rangeEndMin - duration));
      setDrag({ ...drag, moved: true, previewStart: newStart, previewEnd: newStart + duration });
    } else {
      const newEnd = Math.max(origStart + SLOT_MINUTES, Math.min(origEnd + deltaMinutes, rangeEndMin));
      setDrag({ ...drag, moved: true, previewEnd: newEnd });
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { moved, previewStart: finalStart, previewEnd: finalEnd } = drag;
    setDrag(null);
    if (moved) {
      if (finalStart !== origStart || finalEnd !== origEnd) {
        handlers.onSetTaskTime(occ, minutesToTime(finalStart), minutesToTime(finalEnd));
      }
    } else {
      onToggleExpand();
    }
  }

  return (
    <div
      ref={blockRef}
      className={`timeline-block cat-border-${occ.category} ${occ.status === "done" ? "done" : ""} ${expanded ? "expanded" : ""} ${drag?.moved ? "dragging" : ""}`}
      style={{ gridRow: `${startRow} / ${endRow}`, gridColumn: col + 2 }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="timeline-block-main" onPointerDown={(e) => startDrag("move", e)}>
        <input
          type="checkbox"
          checked={occ.status === "done"}
          onPointerDown={(e) => e.stopPropagation()}
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
          <div
            className="timeline-hw-due"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <HomeworkDueCheckbox occ={occ} onSetHomeworkDone={handlers.onSetHomeworkDone} compact />
          </div>
        )}
      </div>

      <div
        className="timeline-resize-handle"
        onPointerDown={(e) => {
          e.stopPropagation();
          startDrag("resize", e);
        }}
        title="Drag to extend or reduce"
      />

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

export default function DayView({
  occurrences,
  onToggle,
  onEdit,
  onDelete,
  onSetHomeworkAssigned,
  onSetHomeworkDone,
  onSetTaskTime,
}: Handlers & { occurrences: Occurrence[] }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const handlers: Handlers = { onToggle, onEdit, onDelete, onSetHomeworkAssigned, onSetHomeworkDone, onSetTaskTime };

  if (occurrences.length === 0) {
    return <p className="empty-state">Nothing scheduled for this day yet.</p>;
  }

  const { blocks, untimed, startHour, endHour, columns } = layoutDay(occurrences);
  const totalSlots = (endHour - startHour) * (60 / SLOT_MINUTES);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const slotsPerHour = 60 / SLOT_MINUTES;
  const rangeStartMin = startHour * 60;
  const rangeEndMin = endHour * 60;

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
              style={{ gridRow: `${(h - startHour) * slotsPerHour + 1} / span ${slotsPerHour}`, gridColumn: 1 }}
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
                rangeStartMin={rangeStartMin}
                rangeEndMin={rangeEndMin}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
