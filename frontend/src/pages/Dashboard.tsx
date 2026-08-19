import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import {
  getChildren,
  getTasks,
  setTaskStatus,
  deleteTask,
  setHomeworkAssigned,
  setHomeworkDone,
  setTaskTime,
  setTaskNote,
  extendTask,
  type Child,
  type Occurrence,
} from "../api";
import { addDays, formatDisplay, formatShortDate, getWeekDates, toISODate } from "../date";
import DayView from "../components/DayView";
import WeekStrip from "../components/WeekStrip";
import TaskForm from "../components/TaskForm";
import AddChildForm from "../components/AddChildForm";
import DeleteTaskDialog from "../components/DeleteTaskDialog";
import EditScopeDialog from "../components/EditScopeDialog";
import EditOccurrenceForm from "../components/EditOccurrenceForm";
import ResetPasswordDialog from "../components/ResetPasswordDialog";
import ThemeToggle from "../components/ThemeToggle";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [viewedId, setViewedId] = useState<number>(user!.id);
  const [viewedName, setViewedName] = useState<string>(user!.name);
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [weekOccurrences, setWeekOccurrences] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editTaskId, setEditTaskId] = useState<number | null>(null);
  const [editScopeTarget, setEditScopeTarget] = useState<Occurrence | null>(null);
  const [editOccurrenceTarget, setEditOccurrenceTarget] = useState<Occurrence | null>(null);
  const [showAddChild, setShowAddChild] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Occurrence | null>(null);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<Child | null>(null);
  const [dismissedExpiring, setDismissedExpiring] = useState<Set<number>>(new Set());

  const loadChildren = useCallback(async () => {
    if (user!.role !== "parent") return;
    const { children } = await getChildren();
    setChildren(children);
  }, [user]);

  const weekDates = getWeekDates(date);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { occurrences } = await getTasks(viewedId, weekStart, weekEnd);
      setWeekOccurrences(occurrences);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load schedule");
    } finally {
      setLoading(false);
    }
  }, [viewedId, weekStart, weekEnd]);

  const dayOccurrences = weekOccurrences.filter((o) => o.date === date);
  const categoriesForDate = (d: string) =>
    Array.from(new Set(weekOccurrences.filter((o) => o.date === d).map((o) => o.category)));

  // Recurring tasks stop generating occurrences past their window (see PROJECT.md) --
  // surface a heads-up while one is within 14 days of that, from whatever's in the loaded week.
  const expiringSoon = useMemo(() => {
    const todayStr = toISODate(new Date());
    const cutoff = addDays(todayStr, 14);
    const seen = new Set<number>();
    const result: { id: number; title: string; endsOn: string }[] = [];
    for (const occ of weekOccurrences) {
      if (occ.recurrence === "none" || !occ.endsOn || seen.has(occ.id) || dismissedExpiring.has(occ.id)) continue;
      if (occ.endsOn >= todayStr && occ.endsOn <= cutoff) {
        seen.add(occ.id);
        result.push({ id: occ.id, title: occ.title, endsOn: occ.endsOn });
      }
    }
    return result;
  }, [weekOccurrences, dismissedExpiring]);

  async function handleExtend(taskId: number) {
    try {
      await extendTask(taskId);
      loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not extend task");
    }
  }

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  function selectSelf() {
    setViewedId(user!.id);
    setViewedName(user!.name);
  }

  function selectChild(child: Child) {
    setViewedId(child.id);
    setViewedName(child.name);
  }

  async function handleToggle(occ: Occurrence) {
    const nextStatus = occ.status === "done" ? "not_done" : "done";
    setWeekOccurrences((prev) =>
      prev.map((o) => (o.id === occ.id && o.date === occ.date ? { ...o, status: nextStatus } : o))
    );
    try {
      await setTaskStatus(occ.id, occ.date, nextStatus);
    } catch {
      loadTasks();
    }
  }

  async function handleSetHomeworkAssigned(occ: Occurrence, assigned: boolean) {
    try {
      await setHomeworkAssigned(occ.id, occ.date, assigned);
      loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update homework");
    }
  }

  async function handleSetHomeworkDone(occ: Occurrence, done: boolean) {
    setWeekOccurrences((prev) =>
      prev.map((o) => (o.id === occ.id && o.date === occ.date ? { ...o, homeworkDone: done } : o))
    );
    try {
      await setHomeworkDone(occ.id, occ.date, done);
    } catch {
      loadTasks();
    }
  }

  async function handleSetTaskTime(occ: Occurrence, startTime: string, endTime: string) {
    setWeekOccurrences((prev) =>
      prev.map((o) => (o.id === occ.id && o.date === occ.date ? { ...o, startTime, endTime } : o))
    );
    try {
      await setTaskTime(occ.id, occ.date, startTime, endTime);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update task time");
      loadTasks();
    }
  }

  async function handleSetTaskNote(occ: Occurrence, note: string) {
    const trimmed = note.trim();
    setWeekOccurrences((prev) =>
      prev.map((o) => (o.id === occ.id && o.date === occ.date ? { ...o, note: trimmed || null } : o))
    );
    try {
      await setTaskNote(occ.id, occ.date, trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save note");
      loadTasks();
    }
  }

  function handleEdit(occ: Occurrence) {
    if (occ.recurrence === "none") {
      setEditTaskId(occ.id);
    } else {
      setEditScopeTarget(occ);
    }
  }

  function handleDelete(occ: Occurrence) {
    setDeleteTarget(occ);
  }

  async function confirmDeleteOne() {
    if (!deleteTarget) return;
    try {
      await deleteTask(deleteTarget.id, deleteTarget.date);
      loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete task");
    } finally {
      setDeleteTarget(null);
    }
  }

  async function confirmDeleteAll() {
    if (!deleteTarget) return;
    try {
      await deleteTask(deleteTarget.id);
      loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete task");
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>OnTrack</h1>
        <div className="header-right">
          <ThemeToggle />
          <span className="signed-in-as">{user!.name}</span>
          <button className="secondary" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <div className="secondary-nav">
        <Link to="/agenda" className="secondary">
          ✅ Agenda
        </Link>
        <Link to="/reports" className="secondary">
          📊 Reports
        </Link>
      </div>

      {user!.role === "parent" && (
        <div className="schedule-switcher">
          <button className={viewedId === user!.id ? "chip selected" : "chip"} onClick={selectSelf}>
            My schedule
          </button>
          {children.map((child) => (
            <div key={child.id} className="chip-group">
              <button
                className={viewedId === child.id ? "chip selected" : "chip"}
                onClick={() => selectChild(child)}
              >
                {child.name}
              </button>
              <button
                type="button"
                className="chip-icon-btn"
                title={`Reset password for ${child.name}`}
                onClick={() => setResetPasswordTarget(child)}
              >
                🔑
              </button>
            </div>
          ))}
          <button className="chip add-chip" onClick={() => setShowAddChild(true)}>
            + Add child
          </button>
        </div>
      )}

      {expiringSoon.length > 0 && (
        <div className="expiring-banner">
          {expiringSoon.map((t) => (
            <div key={t.id} className="expiring-row">
              <span>
                “{t.title}” repeats until {formatShortDate(t.endsOn)} — extend it so it keeps showing up?
              </span>
              <div className="expiring-actions">
                <button type="button" className="secondary" onClick={() => handleExtend(t.id)}>
                  Extend
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setDismissedExpiring((prev) => new Set(prev).add(t.id))}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <WeekStrip
        selectedDate={date}
        onSelect={setDate}
        onPrevWeek={() => setDate((d) => addDays(d, -7))}
        onNextWeek={() => setDate((d) => addDays(d, 7))}
        categoriesForDate={categoriesForDate}
      />

      <div className="day-label">
        <strong>{viewedName}</strong>
        <span>{formatDisplay(date)}</span>
      </div>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="empty-state">Loading…</p>
      ) : (
        <DayView
          occurrences={dayOccurrences}
          onToggle={handleToggle}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onSetHomeworkAssigned={handleSetHomeworkAssigned}
          onSetHomeworkDone={handleSetHomeworkDone}
          onSetTaskTime={handleSetTaskTime}
          onSetTaskNote={handleSetTaskNote}
        />
      )}

      <button className="fab" onClick={() => setShowAddTask(true)}>
        + Add task
      </button>

      {showAddTask && (
        <TaskForm
          ownerId={viewedId}
          defaultDate={date}
          onCancel={() => setShowAddTask(false)}
          onDone={() => {
            setShowAddTask(false);
            loadTasks();
          }}
        />
      )}

      {editTaskId !== null && (
        <TaskForm
          ownerId={viewedId}
          defaultDate={date}
          editTaskId={editTaskId}
          onCancel={() => setEditTaskId(null)}
          onDone={() => {
            setEditTaskId(null);
            loadTasks();
          }}
        />
      )}

      {editScopeTarget && (
        <EditScopeDialog
          occurrence={editScopeTarget}
          onCancel={() => setEditScopeTarget(null)}
          onEditOne={() => {
            const occ = editScopeTarget;
            setEditScopeTarget(null);
            setEditOccurrenceTarget(occ);
          }}
          onEditAll={() => {
            const occ = editScopeTarget;
            setEditScopeTarget(null);
            setEditTaskId(occ.id);
          }}
        />
      )}

      {editOccurrenceTarget && (
        <EditOccurrenceForm
          occurrence={editOccurrenceTarget}
          onCancel={() => setEditOccurrenceTarget(null)}
          onDone={() => {
            setEditOccurrenceTarget(null);
            loadTasks();
          }}
        />
      )}

      {showAddChild && (
        <AddChildForm
          onCancel={() => setShowAddChild(false)}
          onDone={() => {
            setShowAddChild(false);
            loadChildren();
          }}
        />
      )}

      {deleteTarget && (
        <DeleteTaskDialog
          occurrence={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onDeleteOne={confirmDeleteOne}
          onDeleteAll={confirmDeleteAll}
        />
      )}

      {resetPasswordTarget && (
        <ResetPasswordDialog
          childId={resetPasswordTarget.id}
          childName={resetPasswordTarget.name}
          onCancel={() => setResetPasswordTarget(null)}
          onDone={() => setResetPasswordTarget(null)}
        />
      )}
    </div>
  );
}
