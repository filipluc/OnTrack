import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../auth";
import { getChildren, getTasks, setTaskStatus, deleteTask, type Child, type Occurrence } from "../api";
import { addDays, formatDisplay, toISODate } from "../date";
import DayView from "../components/DayView";
import TaskForm from "../components/TaskForm";
import AddChildForm from "../components/AddChildForm";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [viewedId, setViewedId] = useState<number>(user!.id);
  const [viewedName, setViewedName] = useState<string>(user!.name);
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);

  const loadChildren = useCallback(async () => {
    if (user!.role !== "parent") return;
    const { children } = await getChildren();
    setChildren(children);
  }, [user]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { occurrences } = await getTasks(viewedId, date, date);
      setOccurrences(occurrences);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load schedule");
    } finally {
      setLoading(false);
    }
  }, [viewedId, date]);

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
    setOccurrences((prev) =>
      prev.map((o) => (o.id === occ.id && o.date === occ.date ? { ...o, status: nextStatus } : o))
    );
    try {
      await setTaskStatus(occ.id, occ.date, nextStatus);
    } catch {
      loadTasks();
    }
  }

  async function handleDelete(occ: Occurrence) {
    if (!confirm(`Delete "${occ.title}"? This removes every occurrence of this task.`)) return;
    try {
      await deleteTask(occ.id);
      loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete task");
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

      <div className="day-nav">
        <button className="secondary" onClick={() => setDate((d) => addDays(d, -1))}>
          ‹ Prev
        </button>
        <div className="day-label">
          <strong>{viewedName}</strong>
          <span>{formatDisplay(date)}</span>
        </div>
        <button className="secondary" onClick={() => setDate((d) => addDays(d, 1))}>
          Next ›
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="empty-state">Loading…</p>
      ) : (
        <DayView occurrences={occurrences} onToggle={handleToggle} onDelete={handleDelete} />
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
    </div>
  );
}
