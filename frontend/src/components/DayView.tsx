import { useEffect, useRef, useState } from "react";
import type { Occurrence } from "../api";
import { SLOT_MINUTES, SLOT_PX, toMinutes, minutesToTime, computeBlockRows, layoutDay, type TimedBlock } from "./dayLayout";
import { useEscapeKey } from "../useEscapeKey";

const CATEGORY_LABELS: Record<string, string> = {
  school: "School",
  sport: "Sport",
  routine: "Routine",
  leisure: "Leisure",
  study: "Study",
  other: "Other",
};

const DRAG_THRESHOLD_PX = 4;
// Touch only: how long to hold before a press turns into a drag, so a normal scroll swipe
// that starts on a block isn't hijacked. Mouse drags arm immediately (no scroll to conflict with).
const LONG_PRESS_MS = 2000;
// Touch only: if the finger moves this much before the long-press fires, it's a scroll, not a hold.
const LONG_PRESS_CANCEL_PX = 18;

type Handlers = {
  onToggle: (occurrence: Occurrence) => void;
  onEdit: (occurrence: Occurrence) => void;
  onDelete: (occurrence: Occurrence) => void;
  onSetHomeworkAssigned: (occurrence: Occurrence, assigned: boolean) => void;
  onSetHomeworkDone: (occurrence: Occurrence, done: boolean) => void;
  onSetTaskTime: (occurrence: Occurrence, startTime: string, endTime: string) => void;
  onSetTaskNote: (occurrence: Occurrence, note: string) => void;
};

function formatHourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
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

function NoteField({
  occ,
  onSetTaskNote,
}: {
  occ: Occurrence;
  onSetTaskNote: (occurrence: Occurrence, note: string) => void;
}) {
  const [draft, setDraft] = useState(occ.note ?? "");

  useEffect(() => {
    setDraft(occ.note ?? "");
  }, [occ.note]);

  const dirty = draft.trim() !== (occ.note ?? "");

  return (
    <div className="note-field">
      <textarea
        className="note-textarea"
        placeholder="Add a note…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={5}
      />
      {dirty && (
        <button type="button" className="secondary note-save-btn" onClick={() => onSetTaskNote(occ, draft)}>
          Save note
        </button>
      )}
    </div>
  );
}

interface DragState {
  mode: "move" | "resize";
  pointerId: number;
  startX: number;
  startY: number;
  /** True once ready to interpret movement as a drag: immediately for mouse, after a long-press for touch. */
  armed: boolean;
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
  columns,
}: {
  block: TimedBlock;
  expanded: boolean;
  onToggleExpand: () => void;
  handlers: Handlers;
  rangeStartMin: number;
  rangeEndMin: number;
  columns: number;
}) {
  const { occ, col, maxEnd, spansFull } = block;
  const origStart = toMinutes(occ.startTime!);
  const origEnd = toMinutes(occ.endTime!);
  const blockRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<number | null>(null);
  // On touch, the browser can fire a compatibility "click" shortly after our own pointerup
  // handler already expanded the block -- by then Edit/Delete may render at that same
  // screen position and the ghost click lands on one of them. preventDefault() below stops
  // it on spec-compliant browsers; this timestamp is a fallback that swallows any click that
  // still slips through right after a tap-to-expand.
  const suppressClickUntilRef = useRef(0);
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(() => {
    return () => {
      if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
    };
  }, []);

  useEscapeKey(() => {
    if (expanded) onToggleExpand();
  });

  useEffect(() => {
    if (!expanded) return;
    function handleOutsideClick(e: MouseEvent) {
      if (blockRef.current && !blockRef.current.contains(e.target as Node)) onToggleExpand();
    }
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [expanded, onToggleExpand]);

  const previewStart = drag ? drag.previewStart : origStart;
  const previewEnd = drag ? drag.previewEnd : origEnd;
  // While actively dragging, the block shouldn't feel constrained by a neighbor it might be
  // about to move past; once settled, cap it so it doesn't visually bleed into whatever comes
  // right after it in the same column (see layoutDay's maxEnd).
  const { startRow, endRow } = computeBlockRows(previewStart, previewEnd, rangeStartMin, drag ? undefined : maxEnd);
  const gridColumn = spansFull ? `2 / span ${columns}` : String(col + 2);

  function snap(minutes: number): number {
    return Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES;
  }

  function clearPendingTimer() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function armDrag(pointerId: number) {
    setDrag((d) => (d && d.pointerId === pointerId ? { ...d, armed: true } : d));
  }

  function startDrag(mode: "move" | "resize", e: React.PointerEvent) {
    const pointerId = e.pointerId;
    const isTouch = e.pointerType === "touch" || e.pointerType === "pen";
    // Capture synchronously, inside the pointerdown handler itself -- capturing later
    // (e.g. from a setTimeout once the long-press fires) is unreliable on mobile browsers.
    // Capture alone doesn't block native scrolling; touch-action: pan-y still does that job
    // until we explicitly release capture below.
    blockRef.current?.setPointerCapture(pointerId);
    setDrag({
      mode,
      pointerId,
      startX: e.clientX,
      startY: e.clientY,
      armed: !isTouch,
      moved: false,
      previewStart: origStart,
      previewEnd: origEnd,
    });
    if (isTouch) {
      longPressTimer.current = window.setTimeout(() => armDrag(pointerId), LONG_PRESS_MS);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const deltaY = e.clientY - drag.startY;

    if (!drag.armed) {
      // Still waiting out the long-press. Real movement this early means the finger is
      // scrolling the page, not holding still to start a drag -- release capture and back
      // off so the browser's native scroll (touch-action: pan-y) takes it from here.
      const deltaX = e.clientX - drag.startX;
      if (Math.hypot(deltaX, deltaY) > LONG_PRESS_CANCEL_PX) {
        clearPendingTimer();
        blockRef.current?.releasePointerCapture(drag.pointerId);
        setDrag(null);
      }
      return;
    }

    // Armed: this is our drag now, not a page scroll. The touch was stationary through the
    // whole hold, so the browser hasn't committed to a native pan for it yet -- suppress that
    // default here (still on the first real movement after arming) so it doesn't scroll the
    // page underneath the drag.
    e.preventDefault();

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
    clearPendingTimer();
    const { moved, previewStart: finalStart, previewEnd: finalEnd } = drag;
    setDrag(null);
    if (moved) {
      if (finalStart !== origStart || finalEnd !== origEnd) {
        handlers.onSetTaskTime(occ, minutesToTime(finalStart), minutesToTime(finalEnd));
      }
    } else {
      e.preventDefault();
      suppressClickUntilRef.current = Date.now() + 400;
      onToggleExpand();
    }
  }

  function onPointerCancel(e: React.PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    clearPendingTimer();
    setDrag(null);
  }

  return (
    <div
      ref={blockRef}
      className={`timeline-block cat-border-${occ.category} ${occ.status === "done" ? "done" : ""} ${expanded ? "expanded" : ""} ${drag?.armed && !drag.moved ? "armed" : ""} ${drag?.moved ? "dragging" : ""}`}
      style={{ gridRow: `${startRow} / ${endRow}`, gridColumn }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
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
          {occ.note && (
            <span className="note-indicator" title="Has a note">
              📝
            </span>
          )}
          {occ.overridden && (
            <span className="override-indicator" title="Edited for this day only">
              ✎
            </span>
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
        <div
          className="timeline-block-detail"
          onClick={(e) => e.stopPropagation()}
          onClickCapture={(e) => {
            if (Date.now() < suppressClickUntilRef.current) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
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
          {occ.overridden && <p className="override-note">Edited for this day only — other occurrences are unaffected.</p>}
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
          <NoteField occ={occ} onSetTaskNote={handlers.onSetTaskNote} />
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
  onSetTaskNote,
}: Handlers & { occurrences: Occurrence[] }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const handlers: Handlers = {
    onToggle,
    onEdit,
    onDelete,
    onSetHomeworkAssigned,
    onSetHomeworkDone,
    onSetTaskTime,
    onSetTaskNote,
  };

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
              <NoteField occ={occ} onSetTaskNote={onSetTaskNote} />
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
                columns={columns}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
