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
| 2026-08-19 | Fourth round, same feature: the armed outline now held steady, but dragging still didn't move the task — `touch-action: pan-y` let the browser treat the first real movement after arming as a native pan (the touch had been stationary the whole 2s hold, so nothing had committed it to a scroll interpretation yet). Fixed with `e.preventDefault()` on the first `onPointerMove` after arming, which Pointer Events allow (unlike `touchmove`, not forced passive), suppressing the browser's default handling for the rest of that touch. |
| 2026-08-19 | Added a **Reports** page (`/reports`, linked from the dashboard header): totals per category and per task, both **scheduled hours** and **done hours** side by side (decided over "done only" or "scheduled only" — wanted to compare plan vs. actual). Period picker: Day/Week/Month/Year with ‹/› navigation, or a Custom date range. No new backend endpoint — reuses `GET /api/tasks` and aggregates client-side. Same-child-scoping as the main schedule view. Known limitation carried over from the recurrence-window decision: a Year (or long Custom) report under-counts recurring tasks older than their own `starts_on`, since they were never generated that far back — documented in `docs/USER_GUIDE.md` rather than treated as a bug. |
| 2026-08-19 | Moved the Reports link out of the top header row on a follow-up report that it was too cramped on a phone — now its own row below the header, with `flex-wrap` added to the header as a safety net. |
| 2026-08-19 | Added "Antrenament individual" to the Sport fixed-title list. |
| 2026-08-19 | Added **per-occurrence notes** — a free-text box on any task (not category-restricted; motivated by wanting to jot what was covered at a training session) that's specific to that one day, same per-date model as homework tracking (`task_completions.note`, new `POST /api/tasks/:id/note`). A small 📝 previews on the block that a note exists without opening it. |
| 2026-08-19 | Picked 3 of 5 improvements offered after a review pass: (1) edit-just-one-occurrence, (2) a warning + fix for recurring tasks silently expiring after 3 months, (4) streaks. Deferred: PWA/installability, tightening CORS. |
| 2026-08-19 | **Edit only this day**, mirroring the existing delete flow: tapping ✎ on a recurring occurrence now opens `EditScopeDialog` first ("only this day" vs "all occurrences") instead of always editing the whole series. "Only this day" opens a smaller form (category/title/time — no recurrence fields, those describe the whole series) that writes per-occurrence overrides (`task_completions.override_title/category/start_time/end_time`, new `POST /api/tasks/:id/occurrence-edit`) rather than touching the task row. This also **changed drag/resize's existing behavior**: dragging a recurring task's block used to retime every occurrence (a latent mismatch with what a calendar-app drag normally means) — it now writes the same kind of override, so it only retimes the one day dragged. `GET /api/tasks` prefers overrides when present and reports `overridden: true` so the UI can show a task was customized for one day. |
| 2026-08-19 | **Recurring-task expiry warning + extend action**, closing the gap where a task just silently stopped appearing after its 3-month window with no explanation. New `POST /api/tasks/:id/extend` (pushes `ends_on` another 3 months from whichever is later, its current end or today). `Dashboard` shows a dismissible banner for any recurring task in the loaded week within 14 days of its `ends_on`, with Extend/Dismiss actions — no separate notification system, just surfaced from data already being fetched. |
| 2026-08-19 | **Streaks** on the Reports page: a 🔥 card, always visible above the period picker (deliberately independent of it, since "current streak" is inherently relative to today, not to whatever range you're browsing). Fetches its own fixed 100-day lookback, groups by task id, counts consecutive `done` occurrences going backward from today (today itself doesn't break a streak if not yet marked done — there's still time). One-off tasks excluded, since "in a row" doesn't mean anything for something that happens once. |
| 2026-08-19 | Added an **Agenda** page (`/agenda`), a plain weekly checklist grouped by day. Started as a request for "what homework do I have this week" but generalized to all tasks once it came up that a broader view was more useful than a homework-only one. No new backend endpoint — one `GET /api/tasks` call for the selected week. Defaults to hiding done items ("Show done too" reveals them), since the point is surfacing what's left, not a full log; a School occurrence with homework due still gets an inline "HW due"/"HW done" tag. |
| 2026-08-19 | Reworked the homework filter on Agenda into a chip-button row — **All / 📖 Homework / ⚽ Sport** — after a follow-up ask for a Sport filter too. Single-select `FilterMode`, applied on top of (not instead of) the existing done/not-done checkbox. Client-side only, no backend change. |

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
