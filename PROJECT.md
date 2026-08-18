# OnTrack — Project Log

Family task & calendar app: an 11-year-old tracks daily routines, school classes, and
sports/training with done/not-done checkboxes; parents get their own account with the
same features plus full view/edit access to their kid's schedule.

This file is the running log of decisions and status. For how the system is actually
built, see [`docs/TECHNICAL.md`](docs/TECHNICAL.md); for how to use the app day to day,
see [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md). Update this file as the project moves —
don't let it drift out of sync with reality.

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
| 2026-08-18 | Neon project created; `DATABASE_URL` added to `backend/.env` (gitignored, never committed). Full golden path (signup → add child → child adds/completes tasks → parent sees updates) plus permission checks re-verified against the live Neon database — all passed. Test data cleared from Neon afterward so it starts clean for real use. |
| 2026-08-18 | Backend deployed to Render as `ontrack-api` (`https://ontrack-api-2zdi.onrender.com`), confirmed live. Frontend hosting chosen: **Render Static Site**, same account as the backend. `render.yaml` extended with a second (`static`) service for `frontend/`, `VITE_API_BASE_URL` baked in at build time via that service's env var, plus an SPA rewrite (`/*` → `/index.html`) for client-side routing. |
| 2026-08-18 | Child accounts can now share an email with their parent (e.g. one shared family inbox). Login/signup disambiguate by email+password instead of email alone; DB-level unique constraint on `users.email` dropped. |
| 2026-08-18 | Dashboard's day nav replaced with a **week view**: `WeekStrip` shows the Mon–Sun week with a dot on days that have tasks, arrows move a week at a time, tapping a day selects it. |
| 2026-08-18 | Deleting a recurring task now asks **"only this day" vs "all occurrences"** instead of always deleting the whole task. Implemented by reusing the per-date `task_completions` row with a new `'skipped'` status, filtered out on read — no schema change needed beyond that one status value. |

**Project location:** `C:\Github\OnTrack` — full architecture, data model, API
reference, and env var docs live in [`docs/TECHNICAL.md`](docs/TECHNICAL.md).

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

Done:
1. ~~Create a free Neon project, get its Postgres connection string.~~
2. ~~Put that connection string in `backend/.env` as `DATABASE_URL`, verify against a
   real Postgres.~~ Verified 2026-08-18 — see decision log.

Done:
3. ~~Create a Render account, deploy `render.yaml` as a Blueprint, set `DATABASE_URL`.~~
   Backend live at `https://ontrack-api-2zdi.onrender.com`.

Still to do — needs manual dashboard steps only the user can do:
4. Sync the updated `render.yaml` (adds the `ontrack-frontend` static site) in the Render
   dashboard so it picks up the new service and deploys the frontend.
5. Re-verify the golden path end-to-end against the deployed backend + frontend, from an
   actual phone.

**Phase 3 — Android packaging: not started.** Depends on Phase 2. Plan: `npx cap init`
+ `npx cap add android` inside `frontend/`, requires Android Studio + SDK (not yet
installed on this machine — Node 22 and Java 17 already are), `npx cap sync` after each
frontend build.

## Local dev

See [`docs/TECHNICAL.md`](docs/TECHNICAL.md#local-development).

## Open questions

- Same Neon database/branch for local dev and production, or separate branches?
- Whether to give the Render backend a custom domain, or just use its default
  `*.onrender.com` URL.
