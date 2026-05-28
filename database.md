# School Management Database Audit

Audit date: 2026-05-29  
Last updated: 2026-05-29

Aligned with [agent.md](./agent.md). This file covers only School Management Postgres persistence.

## Current DB Status

`GET /api/school-db/status` reports:

| Item | Result |
| --- | --- |
| Postgres configured | true |
| Postgres reachable | true |
| Pending migrations | none |
| Strict DB mode | true |
| Snapshot enabled | false |
| Production mode | true by environment |
| Delete semantics | Documented under `schoolManagementDeleteSemantics` |

Applied migrations include `067_school_foundation.sql`, `074_school_campuses_align.sql`, `074_school_mgmt_cameras_align.sql`, and `075_school_demo_entity_tags.sql`.

## Current Counts

Run `npm run accept:school-management:strict` to refresh. The script clears untagged acceptance residue first, then seeds foundation if empty.

`school_sites` does not exist in the current database; use `school_campuses`.

## Cleanup Risk

| Mechanism | What it removes |
| --- | --- |
| Demo cleanup | Only rows in `school_demo_entity_tags` |
| Orphan spatial | Zones/rooms with no campus hierarchy link |
| Acceptance residue | `*accept*` cameras (hard delete), inactive timetable/roster, acceptance calendar labels |

Do not hard-delete production rows by name pattern alone without reviewing the acceptance-residue preview counts.

## Tables In Scope

`school_campuses`, `school_buildings`, `school_floors`, `school_zones`, `school_rooms`, `school_classes`, `school_sections`, `school_subjects`, `school_teachers`, `school_staff_members`, `school_mgmt_cameras`, `school_timetable_entries`, `school_calendars`, `school_staff_duty_rosters`, `school_demo_entity_tags`.

## Transaction Paths To Re-verify

| Operation | Expected persistence rule |
| --- | --- |
| Master data commit | Atomic Postgres commit through `master-data-import.ts` |
| Camera import | Validate first (including zone/room existence); commit is transactional |
| Timetable import | Validate first; commit appends active rows only |
| Staff duty import | Validate first; commit appends active rows only |
| Demo cleanup | Only removes tagged rows |
| Orphan spatial cleanup | Only orphan zones/rooms from preview |
| Calendar bulk | Upserts `school_calendars` transactionally |

## Required DB Verification

Automated in `scripts/school-management-acceptance.mjs` (strict): before/after counts, CRUD state, bulk commit, setup-health ↔ Postgres alignment.

For manual UI work, pair each action with:

```sql
select count(*) from school_campuses;
select count(*) from school_mgmt_cameras where status = 'Active';
select count(*) from school_timetable_entries where is_active = true;
select count(*) from school_staff_duty_rosters where is_active = true;
```

Residue investigation:

```sql
select id, camera_code, name, status from school_mgmt_cameras where camera_code ilike '%accept%' order by id desc;
select id, is_active from school_timetable_entries order by id desc;
select id, is_active from school_staff_duty_rosters order by id desc;
```

## Open DB Items

| ID | Priority | Task |
| --- | --- | --- |
| DB-P0-01 | P0 | **Done** — `acceptance-residue` preview/cleanup API + overview panel |
| DB-P0-02 | P0 | **Done** — Camera DELETE → `status=Inactive` (documented on status API) |
| DB-P0-03 | P0 | **Done** — Timetable/staff-duty DELETE → `is_active=false` (documented) |
| DB-P0-04 | P0 | **Done (API)** — Master-data bulk in strict acceptance; optional browser sign-off |
| DB-P0-05 | P0 | **Done** — Strict setup-health uses PG active-row counts (`setup-health-pg.ts`) |

## Environment

```bash
DATABASE_URL=postgresql://vms:vms@localhost:5432/vms
SCHOOL_INTELLIGENCE_DB=1
SCHOOL_SNAPSHOT=0
SCHOOL_PRODUCTION_MODE=1
```
