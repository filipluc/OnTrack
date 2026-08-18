# OnTrack — Project Log

Family task & calendar app: an 11-year-old tracks daily routines, school classes, and
sports/training with done/not-done checkboxes; parents get their own account with the
same features plus full view/edit access to their kid's schedule.

This file is the running source of truth for decisions, architecture, and status.
Update it as the project moves — don't let it drift out of sync with reality.

## Decision log

| Date | Decision |
|---|---|
| 2026-08-18 | Project scoped: calendar/task app for kids, covering school + sport, with parent oversight. |
| 2026-08-18 | Parents create their kid's account from inside their own account — no separate kid signup/invite-code flow. |
| 2026-08-18 | Parents can **view and edit** their kid's tasks, not just view. |
| 2026-08-18 | Stack chosen: React+TS+Vite frontend, Node/Express+TS backend, SQLite (`better-sqlite3`), JWT auth. Build as a local web app first, package for Android later via Capacitor. |
| 2026-08-18 | Phase 1 (local web app) built and verified end-to-end (see Status below). |
| 2026-08-18 | Android packaging needs the backend reachable from a phone independent of any PC being on. Two options weighed: keep the PC as the server (LAN-only, free, but only works at home with the PC on) vs. deploy the backend to the cloud (works anywhere, needs a host). **Decided: deploy to the cloud** before doing Android packaging. |

## Architecture

**Project location:** `C:\Github\OnTrack`

- `backend/` — Node.js + Express + TypeScript API
  - Auth: email/password, bcrypt hashing, JWT (`Authorization: Bearer <token>`)
  - DB: SQLite via `better-sqlite3`, single file (`backend/data.sqlite`, gitignored)
- `frontend/` — React + TypeScript + Vite SPA
  - Calls the API via relative `/api/...` paths
  - In dev, Vite's proxy (`frontend/vite.config.ts`) forwards `/api` → `http://localhost:4000`
  - **Not yet configured for production** — a built/Capacitor-wrapped app has no dev proxy, so `/api` calls will fail until the frontend points at an absolute backend URL (part of the cloud deployment work)
- Android (phase 2, after cloud deployment): Capacitor wraps the built frontend into a native Android project

### Data model

- **users**: `id, name, email, password_hash, role ('parent' | 'child'), parent_id (nullable FK → users.id, set for child accounts)`
- **tasks**: `id, owner_id (FK → users.id), title, category ('school' | 'sport' | 'routine' | 'leisure' | 'other'), recurrence ('none' | 'daily' | 'weekly'), days_of_week (nullable, comma-separated 0=Sun..6=Sat), date (nullable, for one-off), start_time, end_time, created_by (FK → users.id)`
- **task_completions**: `id, task_id (FK), date, status ('done' | 'not_done'), completed_at` — one row per task per calendar date, so a recurring task's "done" state resets each day

Recurring tasks are stored once and expanded on the fly per date when building a calendar view.

### API (backend/src/routes)

- `POST /api/auth/signup` — creates a parent account
- `POST /api/auth/login` — returns JWT
- `POST /api/children` / `GET /api/children` — parent creates/lists linked child accounts
- `GET /api/tasks?userId=&from=&to=` — expanded task occurrences for a date range
- `POST /api/tasks`, `PUT /api/tasks/:id`, `DELETE /api/tasks/:id` — task CRUD
- `POST /api/tasks/:id/complete` — set done/not-done for a given date

Access control (`backend/src/routes/tasks.ts` `canAccessUser`): a user can always act on
their own data; a parent can additionally act on any of their linked children's data; a
child cannot access anyone else's data, including other children or the parent's own
tasks. Enforced on every task and child route, verified in testing (see Status).

### Frontend structure

- `src/api.ts` — typed fetch client for the backend
- `src/auth.tsx` — auth context, persists `{token, user}` to `localStorage`
- `src/date.ts` — date helpers (ISO formatting, day-of-week labels)
- `src/pages/` — `Login`, `Signup`, `Dashboard`
- `src/components/` — `DayView` (task list + checkboxes), `TaskForm` (add task modal),
  `AddChildForm` (add child modal)
- `src/App.tsx` — routes + auth guard; `src/main.tsx` — providers (router, auth)

## Status

**Phase 1 — local web app: done and verified (2026-08-18).**

Verified by running both dev servers and driving the full flow through the frontend's
`/api` proxy:
- Type-checks clean on both backend and frontend; frontend production build succeeds.
- Golden path: parent signup → add child → child logs in → adds daily/weekly/one-off
  tasks → marks one done → parent switches to child's schedule and sees the update.
- Permission checks confirmed: a child gets 403 trying to view the parent's schedule or
  add a child account.

No browser screenshot tool was available in the dev environment, so the UI itself
(layout, styling, click behavior) has not been visually inspected yet — only the
underlying API calls it makes. Worth a manual look in an actual browser before relying
on it day-to-day.

**Phase 2 — cloud deployment: in progress, starting now.**

Needed before Android packaging can work without the PC running:
1. Pick and set up a host for the backend (persistent URL, SQLite-compatible or migrate
   to a hosted DB if the platform needs it — TBD based on host chosen).
2. Point the frontend's API base URL at the deployed backend instead of the relative
   `/api` + Vite-proxy setup (dev-only).
3. Re-verify the golden path against the deployed backend.

**Phase 3 — Android packaging: not started.** Depends on Phase 2. Plan: `npx cap init`
+ `npx cap add android` inside `frontend/`, requires Android Studio + SDK (not yet
installed on this machine — Node 22 and Java 17 already are), `npx cap sync` after each
frontend build.

## Local dev

```
cd backend && npm run dev     # http://localhost:4000
cd frontend && npm run dev    # http://localhost:5173
```

Open `http://localhost:5173`. `backend/data.sqlite` is the local database file
(gitignored) — delete it to reset all data.

## Open questions

- Which cloud host for the backend? (needs picking as part of Phase 2)
- Does the chosen host support a SQLite file directly (e.g. persistent disk / volume),
  or does the DB need to move to a hosted Postgres/MySQL?
- Domain/URL for the deployed API, and how it's kept in sync with the frontend config
  across dev vs. production builds.
