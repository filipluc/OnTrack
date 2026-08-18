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
| 2026-08-18 | Local repo pushed to GitHub: `https://github.com/filipluc/OnTrack` (private), branch `main`. |
| 2026-08-18 | Cloud host chosen: **Render (backend) + Neon (Postgres)**, both free tiers, no credit card. Trade-off vs. Fly.io+SQLite: free forever but Render's free tier has no persistent disk, so this requires the backend to use a real database instead of a SQLite file. **Backend migrated from `better-sqlite3` to `pg`/Postgres** (`backend/src/db.ts` and all route queries) to make this possible. |

## Architecture

**Project location:** `C:\Github\OnTrack`

- `backend/` — Node.js + Express + TypeScript API
  - Auth: email/password, bcrypt hashing, JWT (`Authorization: Bearer <token>`)
  - DB: Postgres via `pg` (`Pool`), connection string from `DATABASE_URL` env var. Schema
    is created on startup (`initSchema()` in `backend/src/db.ts`, idempotent `CREATE TABLE
    IF NOT EXISTS`). Intended for Neon in both local dev and production.
  - `backend/.env` (gitignored) holds `PORT`, `JWT_SECRET`, `DATABASE_URL` — see
    `backend/.env.example` for the shape.
- `frontend/` — React + TypeScript + Vite SPA
  - Calls the API via `${VITE_API_BASE_URL}/api/...`
  - In dev, `VITE_API_BASE_URL` is left unset, so requests hit relative `/api/...` and
    Vite's proxy (`frontend/vite.config.ts`) forwards them to `http://localhost:4000`
  - In production builds (including the Capacitor-wrapped app), `VITE_API_BASE_URL` must
    be set to the deployed backend's origin at build time — see `frontend/.env.example`
- `render.yaml` — Render Blueprint for the backend web service (`rootDir: backend`,
  `npm run build` / `npm start`, `DATABASE_URL` set manually in the Render dashboard,
  `JWT_SECRET` auto-generated)
- Android (phase 3, after cloud deployment): Capacitor wraps the built frontend into a native Android project

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

**Phase 2 — cloud deployment: in progress.**

Code-side work done (2026-08-18):
- Backend migrated from SQLite to Postgres (`pg`), all routes converted to async
  queries, schema init runs on startup.
- Frontend reads `VITE_API_BASE_URL` at build time instead of hardcoding the dev proxy
  path.
- `render.yaml` Blueprint added for one-shot Render setup.
- `backend/.env.example` and `frontend/.env.example` added documenting required vars.

Still to do — needs manual dashboard steps only the user can do (account creation):
1. Create a free Neon project, get its Postgres connection string.
2. Put that connection string in `backend/.env` as `DATABASE_URL` (local dev) — once
   done, verify the migrated backend actually works against a real Postgres (not yet
   tested against real Postgres, only type-checked, since no local Postgres was
   reachable in the dev environment — see Verification note below).
3. Create a Render account, deploy `render.yaml` as a Blueprint (or a manual Web Service
   pointed at `backend/`), set `DATABASE_URL` there too (same Neon string, or a separate
   Neon branch for prod vs. dev).
4. Set `VITE_API_BASE_URL` to the Render service's URL when building the frontend for
   production.
5. Re-verify the golden path end-to-end against the deployed backend.

**Verification note:** the Postgres migration type-checks cleanly but has **not** been
run against a live database yet — this machine has a local PostgreSQL 15 service
installed but stopped, and starting it needs admin rights not available in this
session. First real test will happen once `DATABASE_URL` is set (step 2 above).

**Phase 3 — Android packaging: not started.** Depends on Phase 2. Plan: `npx cap init`
+ `npx cap add android` inside `frontend/`, requires Android Studio + SDK (not yet
installed on this machine — Node 22 and Java 17 already are), `npx cap sync` after each
frontend build.

## Local dev

```
cd backend && npm run dev     # http://localhost:4000, needs DATABASE_URL in backend/.env
cd frontend && npm run dev    # http://localhost:5173
```

Open `http://localhost:5173`. Requires a reachable Postgres (a Neon project works fine
for local dev too — no local Postgres install needed).

## Open questions

- Same Neon database/branch for local dev and production, or separate branches?
- Whether to give the Render backend a custom domain, or just use its default
  `*.onrender.com` URL.
