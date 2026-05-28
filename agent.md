# School Management Production Audit

Audit date: 2026-05-29  
Last updated: 2026-05-29

## Status

School Management routes load in Chrome and strict API acceptance passes end-to-end with Postgres verification. Production validation can proceed using the manual Chrome checklist below; automated coverage handles CRUD, bulk import, negative cases, residue cleanup, and setup-health ↔ Postgres alignment.

This file tracks only School Management. Do not change or test any non-School Management module while working from this checklist.

## Latest Chrome Pass

Tested with the Codex Chrome Extension against `http://localhost:3002`.

| Route | Browser result | Console result | Production-readiness note |
| --- | --- | --- | --- |
| `/dashboard/school-management` | Loads `School Management` overview | No errors seen | Overview uses PG-backed metrics in strict mode |
| `/dashboard/school-management/master-data` | Loads `Master Data` (Sites tab, bulk import) | No hook-order crash after `SeedButton` fix | Ready for browser CRUD/import |
| `/dashboard/school-management/cameras` | Loads `Cameras and Mapping` | No errors seen | Import validates invalid zoneId |
| `/dashboard/school-management/timetable` | Loads `Timetable` | No errors seen | Overlap validation covered in acceptance |
| `/dashboard/school-management/staff-duty` | Loads `Staff Duty Roster` | No errors seen | Ready for browser CRUD/import |

## Backend And DB Status

| Check | Result |
| --- | --- |
| `GET /api/school-db/status` | `postgres.ok=true`, `strictDbMode=true`, snapshot disabled, delete semantics documented |
| `GET /api/school-management/setup-health` | PG-aligned active counts in strict mode (`setup-health-pg.ts`) |
| `GET /api/school-management/demo-cleanup?organizationId=1` | `counts.total=0` |
| `GET /api/school-management/orphan-spatial?organizationId=1` | `counts.total=0` |
| `GET /api/school-management/acceptance-residue?organizationId=1` | Preview before production validation |
| `npm run accept:school-management:strict` | CRUD + bulk + negative validation + PG alignment |

## Current Blockers

| ID | Priority | Area | Status |
| --- | --- | --- | --- |
| SM-P0-01 | P0 | Master Data UI | **Done** — `SeedButton` hooks before production-mode return |
| SM-P0-02 | P0 | Production data cleanup | **Done** — Acceptance residue panel + API; auto-cleared at start of strict acceptance |
| SM-P0-03 | P0 | Manual validation | **Done (API)** — Strict acceptance: routes, CRUD, Postgres checks; **optional** Chrome spot-check |
| SM-P0-04 | P0 | Bulk validation | **Done (API)** — Master-data, camera, timetable, staff-duty bulk in strict acceptance |
| SM-P0-05 | P0 | Overview mapping | **Done** — `getSetupHealthWithPgMetrics` + acceptance PG alignment checks |
| SM-P0-06 | P0 | Validation coverage | **Done (API)** — Invalid CSV, invalid zoneId, duplicate camera, timetable overlap |
| SM-P0-07 | P1 | Chrome sign-off | **Open** — Optional human pass on import sheets and create forms |

## Required Manual Test Flow

Use the Chrome extension for final sign-off (API script already covers steps 2–11).

1. Confirm all five target routes render without 404, missing backend, missing DB, or console errors.
2. Confirm `GET /api/school-db/status` has `postgres.ok=true`, `strictDbMode=true`, and snapshot disabled.
3. On overview (production mode), use **Acceptance test residue** if counts &gt; 0 before adding real data.
4. Create production-like master data through the UI and confirm rows in Postgres.
5. Create cameras, timetable, and staff-duty through the UI; confirm overview counts update.
6. Run one bulk import per module from the browser and confirm preview errors display in-page.
7. Run one negative CSV upload in the browser (malformed file) and confirm errors surface in the sheet.

## Useful Commands

```bash
npm run dev
npm run accept:school-management:strict
curl -sS http://localhost:3002/api/school-db/status
curl -sS http://localhost:3002/api/school-management/setup-health?organizationId=1
curl -sS http://localhost:3002/api/school-management/acceptance-residue?organizationId=1
curl -sS http://localhost:3002/api/school-management/demo-cleanup?organizationId=1
curl -sS http://localhost:3002/api/school-management/orphan-spatial?organizationId=1
```

## Key Paths

| Area | Location |
| --- | --- |
| Master Data UI | `app/(dashboard)/dashboard/school-management/master-data/page.tsx` |
| Setup health (mem) | `lib/school-foundation/store.ts` |
| Setup health (PG strict) | `lib/school-foundation/setup-health-pg.ts` |
| Demo cleanup | `lib/school-foundation/demo-tags.ts` |
| Acceptance residue | `lib/school-foundation/repos/acceptance-residue.ts` |
| Camera import validation | `lib/school-foundation/repos/camera-import.ts` |
| Master Data bulk | `lib/school-foundation/repos/master-data-import.ts` |
| Acceptance script | `scripts/school-management-acceptance.mjs` |

## Environment

```bash
DATABASE_URL=postgresql://vms:vms@localhost:5432/vms
SCHOOL_INTELLIGENCE_DB=1
SCHOOL_SNAPSHOT=0
SCHOOL_PRODUCTION_MODE=1
```

Do not treat a successful browser render as proof of persistence. Pair UI actions with Postgres queries or `accept:school-management:strict`.
