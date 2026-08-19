# OnTrack — Technical Reference

Detailed reference for how the app is built. For decisions, history, and current
status, see [`PROJECT.md`](../PROJECT.md) — this file describes the system as it stands,
not how it got there.

## Stack

- **Frontend:** React + TypeScript + Vite (SPA), React Router
- **Backend:** Node.js + Express + TypeScript
- **Database:** Postgres, accessed via `pg` (`Pool`)
- **Auth:** email/password with bcrypt hashing, JWT bearer tokens
- **Hosting (target):** Neon (Postgres) + Render (backend web service)
- **Mobile (planned):** Capacitor wraps the built frontend for Android

## Repo layout

```
backend/
  src/
    db.ts              Postgres pool + schema init
    auth.ts             JWT signing/verification, requireAuth middleware
    index.ts            Express app entry point
    routes/
      auth.ts            signup, login
      children.ts         parent's child-account management
      tasks.ts             task CRUD, recurrence expansion, completion toggling
  .env / .env.example    PORT, JWT_SECRET, DATABASE_URL
frontend/
  src/
    api.ts               typed fetch client
    auth.tsx             auth context (localStorage-backed)
    date.ts              date helpers
    pages/                Login, Signup, Dashboard
    components/          DayView, TaskForm, AddChildForm
  .env / .env.example    VITE_API_BASE_URL
render.yaml              Render Blueprint for the backend service
```

## Data model

**users**
| column | type | notes |
|---|---|---|
| id | serial PK | |
| name | text | |
| email | text | used as login; **not unique** — a child may share their parent's email, so login/signup disambiguate by email+password together, not email alone |
| password_hash | text | bcrypt |
| role | text | `'parent'` \| `'child'` |
| parent_id | int, nullable | FK → users.id; set only on child accounts |

**tasks**
| column | type | notes |
|---|---|---|
| id | serial PK | |
| owner_id | int | FK → users.id — whose schedule this task is on |
| title | text | |
| category | text | `'school'` \| `'sport'` \| `'routine'` \| `'leisure'` \| `'study'` \| `'other'` |
| recurrence | text | `'none'` \| `'daily'` \| `'weekly'` |
| days_of_week | text, nullable | comma-separated ints, 0=Sun..6=Sat; only used when `recurrence='weekly'` |
| date | text, nullable | `YYYY-MM-DD`; only used when `recurrence='none'` |
| start_time / end_time | text, nullable | `HH:MM`; nullable in the DB, but **required by the API** (`POST`/`PUT`) — column stays nullable since older rows may predate that requirement |
| created_by | int | FK → users.id — who added it (parent or the child themself) |
| starts_on / ends_on | text, nullable | `YYYY-MM-DD`; only set when `recurrence != 'none'` — bounds which dates a recurring task expands into (see below). `null` for one-off tasks, which don't need a window. |

**task_completions**
| column | type | notes |
|---|---|---|
| id | serial PK | |
| task_id | int | FK → tasks.id, `ON DELETE CASCADE` |
| date | text | `YYYY-MM-DD` — which occurrence this completion is for |
| status | text | `'done'` \| `'not_done'` \| `'skipped'` |
| completed_at | text, nullable | ISO timestamp, set when marked done |
| homework_assigned | boolean | true if *this* occurrence's class gave homework (due at the task's next occurrence) |
| homework_due | boolean | true if a previous occurrence of this task assigned homework due *on this date* |
| homework_done | boolean | only meaningful when `homework_due` is true |

Unique constraint on `(task_id, date)` — one completion row per task per day. Recurring
tasks are stored once and **expanded on read**: for a given date range, the backend
walks each date, checks which tasks occur on it (daily = always **and within its
`starts_on`/`ends_on` window**, weekly = day-of-week in `days_of_week` **and within the
window**, none = exact date match), and joins in that date's completion row if one exists
(defaulting to `not_done`). This is why a daily task's checkbox resets each day — the
completion is per-date, not on the task itself. `'skipped'` reuses this same per-date row
to delete a single occurrence of a recurring task without touching the task itself or its
other dates — the occurrence is filtered out during expansion, same as
`'done'`/`'not_done'` otherwise flow through.

**Recurrence window** (`backend/src/routes/tasks.ts#withinRecurrenceWindow`): a recurring
task only expands into occurrences between `starts_on` and `ends_on`, both set server-side
(never client-supplied) — `starts_on` is always "today" at creation time and `ends_on` is
`starts_on` + `RECURRENCE_MONTHS` (currently 3). Two consequences: a newly-added recurring
task never retroactively shows up on past dates before it existed, and it stops generating
new occurrences ~3 months out rather than forever, so it needs re-adding (or a future
"extend" action, not built yet) past that point. Editing a task (`PUT /api/tasks/:id`)
does **not** reset an already-recurring task's window — only switching *into* recurrence
from a one-off task starts a fresh one, since the old task never had a window to begin
with.

**Homework tracking** (`backend/src/routes/tasks.ts#nextOccurrenceOfSubject`): marking
homework as assigned on occurrence date D doesn't just flag D — it finds the *next* class
of the same subject and writes `homework_due = true` onto that occurrence's completion row
(creating it if it doesn't exist yet). "Same subject" is resolved by **title, not task
id**: a school subject is often entered as several separate same-titled tasks rather than
one task with multiple `days_of_week` (e.g. a Monday-only "Maths" task and an unrelated
Thursday-only "Maths" task row) — different weekdays can even have different times. So
`nextOccurrenceOfSubject` looks up every task owned by the same person with a
case-insensitive matching `title` and `category`, computes each one's own next occurrence
after D, and picks whichever comes soonest — which may land on a *different* task id than
the one homework was marked on. This is why "homework due" shows up automatically on the
next class of the same subject (even the very next day, or a same-week second occurrence)
with no cross-date lookup needed at read time: each occurrence's row already carries its
own `homework_due`/`homework_done` state. Unassigning (`assigned: false`) recomputes the
same lookup and clears `homework_due`/`homework_done` on that same target. `homework_done`
can only usefully be set on an occurrence where `homework_due` is true — the frontend only
exposes the control then, though the backend doesn't enforce it.

## API reference

All routes except `/api/auth/*` require `Authorization: Bearer <jwt>`.

| Method | Path | Body / query | Notes |
|---|---|---|---|
| POST | `/api/auth/signup` | `{name, email, password}` | Creates a **parent** account. Returns `{token, user}`. |
| POST | `/api/auth/login` | `{email, password}` | Works for parent or child accounts. Returns `{token, user}`. |
| GET | `/api/children` | — | Parent only. Lists their linked children. |
| POST | `/api/children` | `{name, email, password}` | Parent only. Creates a child account linked to the caller. |
| PUT | `/api/children/:id/password` | `{password}` | Parent only, and only for one of their own children (`parent_id` + `role='child'` checked). Resets the child's password — for when they forget it, since there's no self-service "forgot password" flow. |
| GET | `/api/health` | — | No auth required. Returns `{ok: true}`. Pinged every 10 minutes by `.github/workflows/keep-alive.yml` so the free Render instance doesn't spin down from inactivity. |
| GET | `/api/tasks` | `?userId=&from=&to=` | Returns `{occurrences}` — expanded per-date task instances in the range, inclusive. |
| GET | `/api/tasks/:id` | — | Returns the full task definition (not an occurrence) — `{id, ownerId, title, category, recurrence, daysOfWeek, date, startTime, endTime}`. Used to prefill the edit form, since `GET /api/tasks` occurrences don't carry `daysOfWeek`. |
| POST | `/api/tasks` | `{ownerId, title, category, recurrence, daysOfWeek?, date?, startTime, endTime}` | Creates a task. `startTime`/`endTime` are required (400 without both). |
| PUT | `/api/tasks/:id` | same fields as POST minus `ownerId` | Full update of a task. `title`, `category`, `recurrence`, `startTime`, `endTime` are all required (400 if any is missing). |
| POST | `/api/tasks/:id/time` | `{startTime, endTime}` | Time-only update — for drag-to-move / drag-to-resize on the day timeline, which shouldn't need to resend every other field the way `PUT` does. Both must be `HH:MM` with `startTime < endTime` (400 otherwise). |
| DELETE | `/api/tasks/:id` | `?date=` optional | No `date` (or task is `recurrence='none'`): deletes the task and all its completions (cascade). With `date` on a recurring task: leaves the task alone and marks just that date `'skipped'` instead. |
| POST | `/api/tasks/:id/complete` | `{date, status}` | Upserts the completion row for that date. |
| POST | `/api/tasks/:id/homework-assigned` | `{date, assigned}` | Marks (or unmarks) that the class on `date` gave homework. Writes `homework_due = assigned` onto the *next occurrence of the same subject* — found by title/category match across the owner's tasks, which may be a different task id (see Data model). 400 if no upcoming occurrence is found. |
| POST | `/api/tasks/:id/homework-done` | `{date, done}` | Sets `homework_done` for the occurrence on `date`. |

### Access control

`canAccessUser(req, targetUserId)` in `backend/src/routes/tasks.ts` is the single choke
point:
- A user can always act on their own `userId`.
- A parent can additionally act on any `userId` that is one of their linked children
  (checked via `parent_id` in the `users` table).
- A child can never act on anyone else's `userId` — not the parent's, not a sibling's.

Every task route and the children routes call through this (or the equivalent
`role === 'parent'` check for `/api/children`). A failed check returns `403`, an
unauthenticated request returns `401` (from `requireAuth` in `backend/src/auth.ts`),
a task id that doesn't exist returns `404`.

## Frontend

- **State:** no global store beyond React context. `AuthProvider` (`src/auth.tsx`) holds
  `{token, user}`, persisted to `localStorage` under `ontrack_token` / `ontrack_user`.
  `Dashboard` owns the rest (selected child, selected date, the current week's
  occurrences) as local state.
- **Routing:** `/login`, `/signup`, `/` (Dashboard, behind `RequireAuth`).
- **API client** (`src/api.ts`): thin typed wrapper over `fetch`, attaches the bearer
  token from `localStorage`, throws on non-2xx with the server's `{error}` message.
- **Task occurrences vs. tasks:** the frontend only ever deals in *occurrences* (one
  per date, from `GET /api/tasks`) for display; it never fetches raw `tasks` rows —
  except when editing (see below), which needs the actual task record.
- **Edit flow:** `TaskForm` doubles as both the add and edit form via an optional
  `editTaskId` prop. In edit mode it fetches the full task with `GET /api/tasks/:id` on
  mount (occurrences don't carry `daysOfWeek`, so the add-form's local state can't be
  reused directly), prefills every field including resolving whether the task's title
  matches a `FIXED_TITLES` entry or needs the custom-title fallback, and submits via
  `updateTask` (`PUT`) instead of `addTask` (`POST`). Triggered by the ✎ button in
  `DayView`, next to delete.
- **Week view:** `Dashboard` fetches occurrences for the whole Monday–Sunday week
  containing the selected date in one call (`date.ts#getWeekDates`), and derives both
  the day's task list and which days in `WeekStrip` get a dot from that same set —
  avoids re-fetching per day as you tap around within a week. Each day shows one small
  colored dot per distinct category scheduled that day (`Dashboard#categoriesForDate`,
  capped at 4), not just a single generic "something's on" dot.
- **Day timeline** (`DayView.tsx`): tasks with a time render on a positioned time-grid
  (15-minute slots, `SLOT_PX = 13` — 52px/hour, chosen so drag/resize can snap to
  quarter/half/full hours) instead of a flat list — `layoutDay()` computes each
  block's `grid-row` from its start/end time and greedily assigns a `grid-column` so
  overlapping tasks sit side by side (classic interval-graph coloring, one shared column
  count for the whole day rather than per-cluster, which is simpler at the cost of
  occasionally wasting a column). The grid's hour range defaults to 06:00–22:00 but
  stretches to fit anything scheduled outside that. Each block's own content
  (`.timeline-block-main`) is a single-row 4-column CSS Grid — `auto auto minmax(0,1fr)
  auto` — for checkbox, category badge, title (truncates with an ellipsis rather than
  wrapping), and, only on a School task with `homeworkDue`, an always-visible
  `homeworkDone` checkbox pinned to the last column (`HomeworkDueCheckbox`'s `compact`
  prop shortens its label to "HW" so it fits, `title="Homework for today"` carries the
  full text as a tooltip; the checkbox itself stays the same size as the main
  done-checkbox for a consistent tap target). A small blue `hw-indicator` dot next to the
  title previews `homeworkAssigned` the same way. The block clips overflow
  (`overflow: hidden`) to stay a well-defined rectangle; tapping it expands an
  absolutely-positioned popover (edit/delete + the `homeworkAssigned` toggle) layered
  above via `.timeline-block.expanded { z-index: 20; overflow: visible; }`, without
  disturbing the grid's row sizing. Tasks missing a time (only possible on data older than
  the mandatory-time requirement) render above the grid in a plain "No time set" list
  instead.
- **Drag-to-move / drag-to-resize** (`DayView.tsx#TimelineBlock`): same-day only — there's
  no cross-day dragging, which would need every day of the week visible at once instead of
  just the selected one. Both use the Pointer Events API (`onPointerDown` +
  `setPointerCapture` on the block's own ref, so subsequent move/up events keep targeting
  it even if the pointer leaves its bounds) rather than separate mouse/touch handlers, and
  both snap to the 15-minute grid (`SLOT_MINUTES`) so a drag lands on a
  quarter/half/full-hour boundary. A pointer-down on `.timeline-block-main` starts a
  *move* (drag anywhere on the block shifts both `startTime` and `endTime` by the same
  delta, preserving duration); pointer-down on the thin `.timeline-resize-handle` strip at
  the bottom starts a *resize* (only `endTime` moves, clamped to a 15-minute minimum
  duration). A `DRAG_THRESHOLD_PX = 4` movement gate distinguishes an actual drag from a
  tap — below the threshold, `onPointerUp` falls through to the normal tap-to-expand
  behavior instead of committing a time change; this is also why the checkbox and
  homework-due controls need their own `onPointerDown` (not just `onClick`)
  `stopPropagation`, so tapping them doesn't register as the start of a block-level drag.
  While dragging, the block's row is computed live from local `drag` state (not the
  server-derived `block` prop) so it visually follows the pointer without waiting on a
  round trip; on release, `handlers.onSetTaskTime` fires `POST /api/tasks/:id/time` and
  `Dashboard` optimistically patches `weekOccurrences` so the block resolves to its
  final position immediately rather than snapping back and forward. The drag is clamped to
  the grid's current `[startHour, endHour]` range — it does not grow the grid mid-drag to
  let a task go earlier/later than what's already displayed. Column reassignment for
  overlaps only happens on the next full `layoutDay()` pass (i.e. after the drop, once
  fresh data loads) — a block dragged mid-air can visually overlap a neighbor until
  released. `MIN_BLOCK_MINUTES` was raised from 30 to 45 specifically to leave room for the
  resize handle at the bottom of even the shortest block, since the extra fixed-height
  strip didn't fit inside the old minimum without clipping. This single-row layout went through a few iterations (stacked badge-over-title,
  a separate homework row below) before landing here — CSS Grid with explicit columns
  ended up far more predictable than flex + `-webkit-line-clamp` for keeping everything
  reliably on one line.
- **Theme:** `ThemeToggle.tsx` toggles a `data-theme` attribute on `<html>` between
  `"light"`/`"dark"`, persisted to `localStorage` under `ontrack_theme`; defaults to
  `prefers-color-scheme` if nothing is stored. `index.html` sets the attribute
  synchronously (inline `<script>` in `<head>`, before any CSS paints) to avoid a
  light-mode flash on load. All theme-dependent colors are CSS custom properties on
  `:root`, overridden both by `@media (prefers-color-scheme: dark)` and by
  `:root[data-theme="dark"]` so an explicit toggle always wins over system preference.
- **Delete flow:** `DeleteTaskDialog` branches on `occurrence.recurrence`. A one-off task
  (`'none'`) just confirms and calls `deleteTask(id)`. A recurring task offers "only this
  day" (`deleteTask(id, date)` — skips just that occurrence) vs. "all occurrences"
  (`deleteTask(id)` — removes the whole task).
- **Add-task titles** (`TaskForm.tsx#FIXED_TITLES`): there's no free-text title field by
  default — picking a category picks a fixed dropdown of that category's typical titles
  (e.g. School → Mate/Romana/Istorie/Geografie/Sport), with a trailing "Other…" entry that
  reveals a free-text input instead. `category: 'other'` has no fixed list (`FIXED_TITLES.other
  = []`) and goes straight to free text. The list is a frontend-only constant, not
  server-enforced — the backend accepts any non-empty title string.

## Environment variables

**backend/.env**
| var | required | notes |
|---|---|---|
| `PORT` | no (defaults 4000) | |
| `JWT_SECRET` | yes | long random string; Render's Blueprint auto-generates one |
| `DATABASE_URL` | yes | Postgres connection string, e.g. from Neon (`...?sslmode=require`) |

**frontend/.env**
| var | required | notes |
|---|---|---|
| `VITE_API_BASE_URL` | no in dev, yes in production builds | origin only, no trailing slash or `/api` suffix, e.g. `https://ontrack-api.onrender.com`. Unset in dev so requests go through Vite's `/api` proxy to `localhost:4000` (see `vite.config.ts`). |

Both `.env` files are gitignored; `.env.example` in each folder documents the shape
without real secrets.

## Local development

```
cd backend && npm run dev     # tsx watch, http://localhost:4000
cd frontend && npm run dev    # vite, http://localhost:5173
```

Needs `backend/.env` with a working `DATABASE_URL` — a Neon project works fine for this
too, no local Postgres install required. Schema is created automatically on first
backend startup (`initSchema()`, idempotent).

## Deployment

- **Database:** Neon project, free tier. Connection string goes into `DATABASE_URL`.
- **Backend:** `render.yaml` Blueprint at the repo root — Render reads it and creates a
  web service with `rootDir: backend`, `npm install && npm run build` as the build
  command, `npm start` to run. `JWT_SECRET` is auto-generated by the Blueprint;
  `DATABASE_URL` must be set manually in the Render dashboard (marked `sync: false` in
  the Blueprint so it isn't committed anywhere).
- **Frontend:** built with `VITE_API_BASE_URL` set to the Render service's URL
  (`npm run build` inside `frontend/`, reading `.env.production` or an env var at build
  time). The static output in `frontend/dist/` is what a static host would serve, and
  what Capacitor wraps for Android.
- **Keep-alive:** `.github/workflows/keep-alive.yml` pings `GET /api/health` every 10
  minutes via a GitHub Actions cron schedule, since Render's free web-service tier spins
  down after ~15 minutes of inactivity and the first request after that can take ~50s to
  wake it back up. Runs regardless of whether anyone has the app open. GitHub Actions cron
  isn't guaranteed to the minute (can slip further under platform load), so this reduces
  cold starts rather than eliminating them entirely.

## Planned: Android packaging (Capacitor)

Not started yet — depends on the frontend having a working absolute `VITE_API_BASE_URL`
pointed at the deployed backend (Capacitor apps have no dev proxy).

1. `npx cap init` and `npx cap add android` inside `frontend/`
2. Requires Android Studio + Android SDK (not installed on the dev machine as of
   2026-08-18; Node 22 and Java 17 already are)
3. `npm run build` then `npx cap sync` after every frontend change, open in Android
   Studio to run on an emulator or device

## Security notes

- Passwords are hashed with bcrypt (`bcryptjs`, cost factor 10), never stored or logged
  in plaintext.
- JWTs are signed with `JWT_SECRET`, expire after 30 days (`backend/src/auth.ts`), and
  carry only `{id, role}` — no PII in the token payload.
- All cross-user access goes through `canAccessUser`; there is no endpoint that trusts a
  client-supplied `userId` without checking it against the caller's own id or their
  linked children.
- CORS is currently wide open (`app.use(cors())` with no origin restriction) — fine
  while the frontend origin isn't fixed yet, but worth tightening to the actual deployed
  frontend origin once that's stable.
