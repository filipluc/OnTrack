// In dev, VITE_API_BASE_URL is unset and requests go through Vite's proxy to localhost.
// In production builds (including the Capacitor-wrapped app), it must point at the
// deployed backend, since there is no dev proxy to fall back on.
const API_BASE = `${import.meta.env.VITE_API_BASE_URL ?? ""}/api`;

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "parent" | "child";
  parentId?: number | null;
}

function getToken(): string | null {
  return localStorage.getItem("ontrack_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function signup(name: string, email: string, password: string) {
  return request<{ token: string; user: AuthUser }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export function login(email: string, password: string) {
  return request<{ token: string; user: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export interface Child {
  id: number;
  name: string;
  email: string;
}

export function getChildren() {
  return request<{ children: Child[] }>("/children");
}

export function addChild(name: string, email: string, password: string) {
  return request<Child>("/children", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export type Category = "school" | "sport" | "routine" | "leisure" | "other";
export type Recurrence = "none" | "daily" | "weekly";

export interface Occurrence {
  id: number;
  title: string;
  category: Category;
  recurrence: Recurrence;
  startTime: string | null;
  endTime: string | null;
  date: string;
  status: "done" | "not_done";
  /** True if this class session itself gave homework (due at the next occurrence of the same task). */
  homeworkAssigned: boolean;
  /** True if a previous occurrence of this task assigned homework due on this date. */
  homeworkDue: boolean;
  /** Only meaningful when homeworkDue is true. */
  homeworkDone: boolean;
}

export function getTasks(userId: number, from: string, to: string) {
  return request<{ occurrences: Occurrence[] }>(`/tasks?userId=${userId}&from=${from}&to=${to}`);
}

export interface NewTask {
  ownerId: number;
  title: string;
  category: Category;
  recurrence: Recurrence;
  daysOfWeek?: number[];
  date?: string;
  startTime?: string;
  endTime?: string;
}

export function addTask(task: NewTask) {
  return request<{ id: number }>("/tasks", {
    method: "POST",
    body: JSON.stringify(task),
  });
}

/** Pass `date` to delete just that occurrence of a recurring task; omit it to delete the whole task. */
export function deleteTask(id: number, date?: string) {
  const query = date ? `?date=${date}` : "";
  return request<{ ok: true }>(`/tasks/${id}${query}`, { method: "DELETE" });
}

export function setTaskStatus(id: number, date: string, status: "done" | "not_done") {
  return request<{ ok: true }>(`/tasks/${id}/complete`, {
    method: "POST",
    body: JSON.stringify({ date, status }),
  });
}

/** Mark (or unmark) that this occurrence's class gave homework, due at the next occurrence of the same task. */
export function setHomeworkAssigned(id: number, date: string, assigned: boolean) {
  return request<{ ok: true }>(`/tasks/${id}/homework-assigned`, {
    method: "POST",
    body: JSON.stringify({ date, assigned }),
  });
}

/** Mark whether the homework due on this occurrence has been done. */
export function setHomeworkDone(id: number, date: string, done: boolean) {
  return request<{ ok: true }>(`/tasks/${id}/homework-done`, {
    method: "POST",
    body: JSON.stringify({ date, done }),
  });
}
