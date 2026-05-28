# School Management and School Intelligence Audit

Audit date: 2026-05-28

Scope:
- Source spec: `/Users/moneetsaraswat/Documents/GitHub/business_intelligence/README.md`
- Local dashboard checked with Browser: `http://localhost:3002`
- Chrome extension check: `http://localhost:3001/dashboard` and `http://localhost:3002/dashboard/school-management`
- Focus modules: School Management and School Intelligence only
- Documentation-only pass. No app implementation code was changed in this pass.

## Executive Summary

The README route map is mostly implemented for the current school scope. The visible School Management and School Intelligence submenu items render and navigate in the browser. Representative detail routes also render:
- `/dashboard/school-management/cameras/242`
- `/dashboard/school-intelligence/events/1`

The biggest incomplete area is runtime consistency. The running `3002` app reports Postgres disabled and snapshot enabled, while local Docker Postgres is healthy and contains richer school data. UI/API checks therefore validate the snapshot-backed runtime, not the Docker-backed acceptance path.

## README Alignment

README promises:
- School Management foundation setup: master data, cameras, timetable, calendar, duty roster, AI health, signals, workers, settings.
- School Intelligence pipeline: foundation readiness, rules, events, daily summaries, scores, GPT summary, Q&A, recommendations, action tasks.
- Runtime modes: snapshot/mock, DB-backed via `DATABASE_URL` + `SCHOOL_INTELLIGENCE_DB=1`, and live GPT via `OPENAI_API_KEY`.

Current status:
- Source files exist for all main README routes.
- Redirect-only routes exist and redirect correctly:
  - `/dashboard/school-intelligence/incidents` -> `/dashboard/school-intelligence/discipline`
  - `/dashboard/school-intelligence/occupancy` -> `/dashboard/school-intelligence/student-occupancy`
- README mentions `.env.local`, but this repo currently has only `.env.example` and `.env.production`.

## Browser Route Results

Clicked through these visible School Management submenu items successfully:
- `/dashboard/school-management`
- `/dashboard/school-management/master-data`
- `/dashboard/school-management/cameras`
- `/dashboard/school-management/ai-health`
- `/dashboard/school-management/signals`
- `/dashboard/school-management/workers`
- `/dashboard/school-management/timetable`
- `/dashboard/school-management/calendar`
- `/dashboard/school-management/staff-duty`
- `/dashboard/school-management/settings`

Clicked through these visible School Intelligence submenu items successfully:
- `/dashboard/school-intelligence`
- `/dashboard/school-intelligence/master-data`
- `/dashboard/school-intelligence/overall-score`
- `/dashboard/school-intelligence/campus-safety`
- `/dashboard/school-intelligence/teacher-productivity`
- `/dashboard/school-intelligence/teacher-supervision`
- `/dashboard/school-intelligence/student-occupancy`
- `/dashboard/school-intelligence/academic-operations`
- `/dashboard/school-intelligence/staff-deployment`
- `/dashboard/school-intelligence/space-utilization`
- `/dashboard/school-intelligence/gate-flow`
- `/dashboard/school-intelligence/parent-experience`
- `/dashboard/school-intelligence/discipline`
- `/dashboard/school-intelligence/compliance`
- `/dashboard/school-intelligence/zones-schedule`
- `/dashboard/school-intelligence/events`
- `/dashboard/school-intelligence/rules`
- `/dashboard/school-intelligence/actions`
- `/dashboard/school-intelligence/digest`
- `/dashboard/school-intelligence/score-settings`

Console:
- A later verified submenu-click pass produced no new warning/error console logs.
- Browser console history still contained earlier Next.js RSC fallback errors of the form `Failed to fetch RSC payload ... Falling back to browser navigation`; treat these as worth watching if they recur on a fresh browser session.

## UI Findings

School Management:
- Overview shows foundation setup `100%`, cameras mapped `45/45`, rooms `30/30`, timetable `200`, roster `50`, and calendar `35`.
- Master Data renders real-looking data and shows `Foundation setup complete - 100% readiness`.
- Cameras page now shows `100% mapped` and `45 total cameras`.
- AI Health renders 45 active cameras, 27% online, 32 critical offline, 33 stale signals.
- Signals renders 500 signals, with 15 signal types and average confidence around 84.8%.
- Workers renders 2 healthy workers.
- Timetable, calendar, staff duty, and settings render populated pages.

School Intelligence:
- Overview renders overall score `48` and a GPT principal summary/recommendations demo flow.
- Master Data Setup shows `100% complete`, but also says only `5 of 7 Phase 1 items complete`; org profile and site profile are still shown as pending. This is an internal readiness-text mismatch.
- Overall Score renders `48/100`.
- Campus Safety renders, but safety/security scores are `0`.
- Events page renders 96 open events.
- Rules page renders 32 enabled rules.
- Digest renders the principal summary and recommendations.
- Action Tasks renders `No open tasks`, while Docker has 3 `school_gpt_action_tasks` rows. This is a runtime/source mismatch caused by the app running snapshot-backed.
- Several daily module pages are thin for the current day: teacher, academic, staff, gate, space, and occupancy pages commonly show `0 periods`, `0 shifts`, `0 windows`, or `No summary facts for this date yet` even though the setup data exists.

## Backend Endpoint Findings

Current `3002` runtime status:
- `/api/school-db/status` returns `postgres.configured=false`, `snapshot.enabled=true`, `openai.configured=false`.
- `cloudZoneActivity.available=false`.
- `POST /api/school-db/migrate` returns `400` with `Set DATABASE_URL and SCHOOL_INTELLIGENCE_DB≠0`.

Core School Management endpoints return `200`:
- `/api/sites`: 1
- `/api/buildings`: 2
- `/api/floors`: 16
- `/api/zones`: 20
- `/api/rooms`: 30
- `/api/classes`: 10
- `/api/sections`: 30
- `/api/subjects`: 3
- `/api/teachers`: 40
- `/api/staff-members`: 20
- `/api/cameras`: 45
- `/api/timetable`: 200
- `/api/school-calendar`: 35
- `/api/staff-duty-rosters`: 50
- `/api/school-time-windows`: 5
- `/api/school-ai-signals/signals`: 500
- `/api/school-ai-signals/workers`: 2
- `/api/school-ai-signals/batches`: 0

Core School Intelligence endpoints return `200`:
- `/api/intelligence-rules`: 32
- `/api/intelligence-events`: 96
- `/api/daily-summaries/overview`: 9 modules
- `/api/school-scores/overall`: overall `48`
- `/api/school-scores/modules`: 10 modules
- `/api/gpt/daily-summary`: summary exists
- `/api/gpt/recommendations`: 3
- `/api/gpt/actions`: 0

## Chrome Extension Check

Chrome extension communication works.

Open Chrome tabs available to claim were cPanel tabs, not a logged-in local dashboard tab. A new Chrome tab to `http://localhost:3001/dashboard` redirected to:
- `http://localhost:3001/login`
- Visible text: `Sign in to access the dashboard`
- No console errors.

Chrome could open `http://localhost:3002/dashboard/school-management` successfully and rendered the School Management page with no console errors.

## Current Incomplete Or Partial Areas

1. DB-backed runtime is not active.
   - Docker Postgres is populated, but the running `3002` process is snapshot-backed.

2. Snapshot data has drifted from Docker data.
   - Runtime API: 30 rooms, 20 zones, 0 GPT actions.
   - Docker: 120 rooms, 80 zones, 3 GPT actions.

3. School Intelligence daily detail pages are partially populated for the current day.
   - Many pages show 0 live periods/shifts/windows or no daily summary facts.

4. Master Data Setup readiness text is inconsistent.
   - It shows `100% complete` and `Ready for Phase 2`, while also saying `5 of 7 Phase 1 items complete`.

5. Aggregator grounding data is unavailable.
   - `/api/school-db/status` reports `cloudZoneActivity.available=false`.
   - Docker table `cloud_zone_activity_summary` is empty.

6. Live GPT is not configured.
   - `/api/school-db/status` reports `openai.configured=false`.
   - Current GPT UI is demo/snapshot-backed.

## Recommended Next Code Work

1. Decide the active acceptance mode for this phase: snapshot-backed demo or DB-backed Docker.
2. If DB-backed, start `3002` with `DATABASE_URL=postgresql://vms:vms@localhost:5432/vms` and `SCHOOL_INTELLIGENCE_DB=1`.
3. Re-run `/api/school-db/status`; it should report `postgres.configured=true`.
4. Reconcile snapshot/API counts with Docker counts, especially rooms, zones, and GPT action tasks.
5. Fix Master Data Setup readiness calculation/text so 100% does not conflict with pending org/site profile tasks.
6. Wire daily module detail pages to the same date/day data used by foundation timetable and roster, or clearly mark empty-current-day states as expected.
7. Populate or intentionally exclude `cloud_zone_activity_summary` for the school-copilot grounding story.
8. Re-check Browser submenu navigation and console logs after DB-backed mode is active.

## Verification Performed

- Read README school module sections and route map.
- Inspected school route/API inventory in source.
- Used Browser to click all visible School Management and School Intelligence submenu routes.
- Read browser console logs during route checks.
- Used direct Browser navigation for redirect/detail routes.
- Used Chrome extension to verify `3001` and `3002` behavior in Chrome.
- Swept key `3002` school APIs with read-only GET requests.
- Checked local Docker Postgres container health and school migration/table state.
