import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../auth";
import { getChildren, getTasks, setTaskStatus, deleteTask, type Child, type Occurrence } from "../api";
import { addDays, formatDisplay, getWeekDates, toISODate } from "../date";
import DayView from "../components/DayView";
import WeekStrip from "../components/WeekStrip";
import TaskForm from "../components/TaskForm";
import AddChildForm from "../components/AddChildForm";
import DeleteTaskDialog from "../components/DeleteTaskDialog";

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
  const [showAddChild, setShowAddChild] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Occurrence | null>(null);

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
  const hasTasks = (d: string) => weekOccurrences.some((o) => o.date === d);

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
          <span className="signed-in-as">{user!.name}</span>
          <button className="secondary" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      {user!.role === "parent" && (
        <div className="schedule-switcher">
          <button className={viewedId === user!.id ? "chip selected" : "chip"} onClick={selectSelf}>
            My schedule
          </button>
          {children.map((child) => (
            <button
              key={child.id}
              className={viewedId === child.id ? "chip selected" : "chip"}
              onClick={() => selectChild(child)}
            >
              {child.name}
            </button>
          ))}
          <button className="chip add-chip" onClick={() => setShowAddChild(true)}>
            + Add child
          </button>
        </div>
      )}

      <WeekStrip
        selectedDate={date}
        onSelect={setDate}
        onPrevWeek={() => setDate((d) => addDays(d, -7))}
        onNextWeek={() => setDate((d) => addDays(d, 7))}
        hasTasks={hasTasks}
      />

      <div className="day-label">
        <strong>{viewedName}</strong>
        <span>{formatDisplay(date)}</span>
      </div>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="empty-state">Loading…</p>
      ) : (
        <DayView occurrences={dayOccurrences} onToggle={handleToggle} onDelete={handleDelete} />
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
    </div>
  );
}
