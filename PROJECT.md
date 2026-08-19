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
| 2026-08-18 | Added homework tracking for School tasks: marking "homework given today" on one class occurrence auto-flags the task's *next* occurrence as having homework due, with its own done/not-done checkbox that only appears on that due date. Backed by three new `task_completions` columns (`homework_assigned`, `homework_due`, `homework_done`) rather than a separate table, since it's inherently per-occurrence state like completion status already is. "Next occurrence" matches by **title**, not task id, since the same subject is often entered as several separate same-titled tasks (different weekday, different time) rather than one task with multiple `days_of_week`. |
| 2026-08-18 | Recurring tasks now only generate occurrences going forward from creation, for a fixed **3-month window** (`tasks.starts_on`/`ends_on`, set server-side) — not retroactively into the past, and not forever. A task past its window just stops appearing; there's no re-up/extend flow yet. |
| 2026-08-19 | Add-task form replaced free-text title with a **fixed per-category title list** (School: Mate, Romana, Istorie, Geografie, Sport; Sport: Antrenament fotbal, Antrenament Coerver, Sport complementar, Meci fotbal, Turneu; Routine: Spalat pe dinti, Pregatit ghiozdan; Leisure: TV, PS; Study: Teme scoala, Extra Mate/Romana, Extra Engleza, Duolingo, Citit) plus an "Other…" entry for a free-text title. Added a new **Study** category (`school`/`sport`/`routine`/`leisure`/`study`/`other`) since none of the existing ones fit extra-curricular study time. The list itself is frontend-only — the backend still accepts any title string. |
| 2026-08-19 | Start/end time are now **required** when adding or editing a task (was optional), enforced both client-side (`required` inputs) and server-side (400 without both). Added **task editing**: a ✎ button next to delete opens the same `TaskForm` pre-filled via a new `GET /api/tasks/:id`, submitting through `PUT` instead of `POST` — there was previously no way to change a task after creating it short of deleting and re-adding. |
| 2026-08-19 | Batch of visual/functional improvements after a general review: **day view redesigned as a time-positioned grid** (`DayView.tsx#layoutDay`) instead of a flat list — tasks are blocks placed by start/end time, side-by-side when overlapping, tap-to-expand for full details/actions; **dark mode** (`ThemeToggle.tsx`, CSS custom properties on `:root`, persisted to `localStorage`, defaults to system preference); **`WeekStrip` dots are now colored per category** instead of one generic dot; **parent can reset a child's forgotten password** (`PUT /api/children/:id/password`, 🔑 button next to the child's chip) — there was no recovery path before; **keep-alive workflow** (`.github/workflows/keep-alive.yml`, pings `GET /api/health` every 10 min) to reduce Render free-tier cold starts. Explicitly deferred for later: stats/streaks and PWA/phone-installability. |
| 2026-08-19 | Iterated on the day-timeline block layout based on visual feedback (a screenshot, since this dev environment has no browser to check rendering itself): settled on a single-row 4-column CSS Grid (checkbox / category badge / title / homework-due checkbox) per block — tried stacking the badge above the title and a separate homework row below first, both of which either overflowed the block or didn't stay on one line; explicit grid columns proved far more predictable than flex + `-webkit-line-clamp` for this. |
| 2026-08-19 | Added **drag-to-move and drag-to-resize** on the day timeline, same-day only (no cross-day drag — would need a full week grid, not built). Snaps to a 15-minute grid so it always lands on a quarter/half/full hour. New lightweight `POST /api/tasks/:id/time` endpoint so a drag commit doesn't need to resend every task field like the full edit `PUT` does. Untested by me beyond code review and type-checking — this is the first interactive-gesture feature added, and needs real hands-on testing (mouse and touch) since this dev environment still has no browser. |
| 2026-08-19 | Fixed a real bug found via testing: the edit-task modal rendered *behind* an expanded day-timeline block (`.modal-backdrop` had `z-index: 10`, lower than the block's `z-index: 20`/`30`). Bumped the modal backdrop to `z-index: 100` so it's unambiguously above any in-page content. |
| 2026-08-19 | Fixed a second real bug found via on-phone testing: touch drag was hijacking ordinary page scroll — any touch starting on a block (most of the screen on a busy day) got captured as a drag instead of letting the page scroll. Fixed with a **2-second long-press gate on touch** (mouse still drags immediately, no such conflict there): a touch doesn't arm/capture the pointer until held still for `LONG_PRESS_MS`, and `touch-action: pan-y` (not `none`) lets the browser scroll normally if the finger moves before that. |
| 2026-08-19 | Third round on the same feature, again from on-phone testing: after the long-press fix, the "armed" outline flashed on then immediately vanished and dragging didn't work. Two causes: `setPointerCapture` was being called from inside the `setTimeout` callback when the long-press fired, which isn't reliable on a real phone — moved to fire synchronously in `pointerdown` instead (capture alone doesn't block scrolling, so this is safe). And the 10px movement threshold for cancelling a pending long-press was tight enough that ordinary hand tremor while holding still could trip it on its own — loosened to 18px. |

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
