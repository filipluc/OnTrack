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

export function resetChildPassword(childId: number, password: string) {
  return request<{ ok: true }>(`/children/${childId}/password`, {
    method: "PUT",
    body: JSON.stringify({ password }),
  });
}

export type Category = "school" | "sport" | "routine" | "leisure" | "study" | "other";
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
  /** Free-text note on this occurrence (e.g. what was covered at that day's training). */
  note: string | null;
  /** True if title/category/time were overridden for just this occurrence, rather than inherited from the task. */
  overridden: boolean;
  /** The task's recurrence window end, if recurring — used to warn when it's about to stop generating occurrences. */
  endsOn: string | null;
  /** Minutes before startTime to send a reminder push, or null for no reminder on this task. */
  remindMinutesBefore: number | null;
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
  startTime: string;
  endTime: string;
  remindMinutesBefore?: number | null;
}

export function addTask(task: NewTask) {
  return request<{ id: number }>("/tasks", {
    method: "POST",
    body: JSON.stringify(task),
  });
}

export interface TaskDetail {
  id: number;
  ownerId: number;
  title: string;
  category: Category;
  recurrence: Recurrence;
  daysOfWeek: number[];
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  remindMinutesBefore: number | null;
}

export function getTask(id: number) {
  return request<TaskDetail>(`/tasks/${id}`);
}

export interface TaskEdits {
  title: string;
  category: Category;
  recurrence: Recurrence;
  daysOfWeek?: number[];
  date?: string;
  startTime: string;
  endTime: string;
  remindMinutesBefore?: number | null;
}

export function updateTask(id: number, task: TaskEdits) {
  return request<{ ok: true }>(`/tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify(task),
  });
}

/** Lightweight time-only update, for drag-to-move / drag-to-resize on the day timeline. For a recurring task this only retimes the dragged occurrence. */
export function setTaskTime(id: number, date: string, startTime: string, endTime: string) {
  return request<{ ok: true }>(`/tasks/${id}/time`, {
    method: "POST",
    body: JSON.stringify({ date, startTime, endTime }),
  });
}

export interface OccurrenceEdits {
  title: string;
  category: Category;
  startTime: string;
  endTime: string;
}

/** "Edit only this day": overrides title/category/time on a single occurrence, leaving the rest of a recurring series untouched. */
export function updateOccurrence(id: number, date: string, edits: OccurrenceEdits) {
  return request<{ ok: true }>(`/tasks/${id}/occurrence-edit`, {
    method: "POST",
    body: JSON.stringify({ date, ...edits }),
  });
}

/** Pushes a recurring task's window another ~3 months out so it keeps generating occurrences. */
export function extendTask(id: number) {
  return request<{ ok: true; endsOn: string }>(`/tasks/${id}/extend`, { method: "POST" });
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

/** Set (or clear, with an empty string) the note on this occurrence. */
export function setTaskNote(id: number, date: string, note: string) {
  return request<{ ok: true }>(`/tasks/${id}/note`, {
    method: "POST",
    body: JSON.stringify({ date, note }),
  });
}

export function getPushPublicKey() {
  return request<{ publicKey: string }>("/push/public-key");
}

export function subscribePush(subscription: PushSubscriptionJSON) {
  return request<{ ok: true }>("/push/subscribe", {
    method: "POST",
    body: JSON.stringify({ subscription }),
  });
}

export function unsubscribePush(endpoint: string) {
  return request<{ ok: true }>("/push/unsubscribe", {
    method: "POST",
    body: JSON.stringify({ endpoint }),
  });
}

/** What time of day (HH:MM) to check for still-unfinished homework and send a reminder. */
export function getNotificationSettings() {
  return request<{ homeworkCheckTime: string }>("/push/settings");
}

export function setNotificationSettings(homeworkCheckTime: string) {
  return request<{ ok: true }>("/push/settings", {
    method: "PUT",
    body: JSON.stringify({ homeworkCheckTime }),
  });
}

export interface EliteU13Match {
  matchId: string;
  round: number;
  date: string;
  home: string;
  away: string;
  homeGoals: number | null;
  awayGoals: number | null;
  played: boolean;
  stadium: string | null;
  town: string | null;
}

export interface MatchSheetPlayer {
  name: string;
  shirtNo: number;
  captain: boolean;
  position: string;
}
export interface MatchSheetStaff {
  name: string;
  role: string;
}
export interface MatchSheetClub {
  name: string;
  starters: MatchSheetPlayer[];
  reserves: MatchSheetPlayer[];
  staff: MatchSheetStaff[];
}
export interface EliteU13MatchSheet {
  home: MatchSheetClub;
  away: MatchSheetClub;
}

/** Live-fetched (with a server-side cache) from hailafotbal.ro — not stored in our own DB. */
export function getEliteU13Schedule() {
  return request<{ team: string; matches: EliteU13Match[] }>("/elite-u13/schedule");
}

/** Lineups/staff for one match. Only available from ~75 minutes before kickoff onward. */
export function getEliteU13MatchSheet(matchId: string) {
  return request<EliteU13MatchSheet>(`/elite-u13/match/${matchId}/sheet`);
}

export interface CupaMatch {
  time: string;
  field?: string;
  group: string;
  home: string;
  away: string;
  score?: string;
}
export interface CupaDay {
  label: string;
  matches: CupaMatch[];
}
export interface CupaStandingsRow {
  rank: number;
  team: string;
  played: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  diff: number;
}
export interface CupaStandingsGroup {
  group: string;
  rows: CupaStandingsRow[];
}
export interface CupaScheduleResponse {
  updatedAt: string;
  sheets: Record<string, CupaDay[]>;
  standings: Record<string, CupaStandingsGroup[]>;
  /** True if the live fetch just failed and this is the last known good data instead. */
  stale: boolean;
}

/** Live-fetched (with a server-side cache) straight from the organizer's Google Sheets. */
export function getCupaSchedule() {
  return request<CupaScheduleResponse>("/cupa/schedule");
}

export interface FrfAjfMatch {
  round: number;
  date: string;
  time: string | null;
  venue: string | null;
  home: string;
  away: string;
  homeGoals: number | null;
  awayGoals: number | null;
  played: boolean;
  bye: boolean;
  matchUrl: string;
}
export interface FrfAjfScheduleResponse {
  team: string;
  updatedAt: string;
  matches: FrfAjfMatch[];
  /** True if the live fetch just failed and this is the last known good data instead. */
  stale: boolean;
}

/** Live-fetched (with a server-side cache) from frf-ajf.ro — not stored in our own DB. */
export function getWorkitSchedule() {
  return request<FrfAjfScheduleResponse>("/frf-ajf/schedule");
}
