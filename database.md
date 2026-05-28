# School Database and Docker Audit

Audit date: 2026-05-28

Scope:
- Local Docker Postgres container: `vms-postgres`
- Database: `vms`
- User: `vms`
- App: `/Users/moneetsaraswat/Documents/GitHub/business_intelligence`
- Modules in scope: School Management and School Intelligence only
- Documentation-only pass. No app implementation code was changed in this pass.

## Current Docker State

Docker Postgres is running and healthy:

```text
vms-postgres   postgres:16   Up healthy   5432->5432
```

Connection check:

```text
database: vms
user: vms
version: PostgreSQL 16.13
```

Docker contains populated school tables. It is ahead of the currently running `3002` app because the app is not DB-enabled.

## Running App DB Status

`GET /api/school-db/status` currently returns:

```json
{
  "postgres": {
    "enabled": false,
    "applied": [],
    "configured": false
  },
  "snapshot": {
    "enabled": true,
    "exists": true,
    "path": "/Users/moneetsaraswat/Documents/GitHub/business_intelligence/.data/school-intelligence.json"
  },
  "openai": {
    "configured": false
  },
  "aggregator": {
    "cloudZoneActivity": {
      "available": false,
      "rowCount": null
    }
  }
}
```

`POST /api/school-db/migrate` currently returns:

```json
{
  "ok": false,
  "error": "Set DATABASE_URL and SCHOOL_INTELLIGENCE_DB≠0"
}
```

This confirms the running app process is not using Docker Postgres.

## Environment Files

Present:
- `.env.example`
- `.env.production`

Missing:
- `.env.local`

`.env.example` documents:
- `DATABASE_URL=postgresql://vms:vms@localhost:5432/vms`
- `SCHOOL_INTELLIGENCE_DB=1`
- `OPENAI_API_KEY=sk-...`
- `SCHOOL_SNAPSHOT=1`

## Source Migration Set

`lib/school-db/migrate.ts` currently includes these school migrations:

```text
create_organizations_table.sql
067_school_foundation.sql
068_school_ai_signals.sql
069_school_rule_engine.sql
070_school_daily_summaries.sql
071_school_score_engine.sql
072_school_gpt_copilot.sql
073_school_runtime_snapshot.sql
074_school_campuses_align.sql
074_school_mgmt_cameras_align.sql
```

The same files exist under `db/migrations`.

## Docker Migration Records

Docker has all source-listed school migrations recorded. No source-listed school migration is missing from Docker.

`schema_migrations` column shape in Docker:

```text
file text
applied_at bigint
```

Current source creates `applied_at TIMESTAMPTZ` on clean DBs, but detects existing bigint migration tables and writes epoch seconds for compatibility. Local Docker remains compatible, but its metadata shape differs from a clean current DB.

Docker also contains many non-school migration records from the wider/main VMS project. For this audit, only the source-listed school migrations above were compared.

## Docker Table Counts

Foundation / management:
- `organizations`: 4
- `school_campuses`: 1
- `school_buildings`: 2
- `school_floors`: 4
- `school_zones`: 80
- `school_rooms`: 120
- `school_mgmt_cameras`: 45
- `school_classes`: 10
- `school_sections`: 30
- `school_subjects`: 3
- `school_teachers`: 40
- `school_staff_members`: 20
- `school_timetable_entries`: 200
- `school_calendars`: 35
- `school_staff_duty_rosters`: 50

Signals / operational intelligence:
- `school_ai_signals`: 19642
- `school_ai_workers`: 2
- `school_ai_signal_batches`: 45
- `school_intelligence_rules`: 32
- `school_intelligence_events`: 96

Scores / GPT:
- `school_daily_scores`: 1
- `school_daily_module_scores`: 10
- `school_gpt_summaries`: 1
- `school_gpt_recommendations`: 3
- `school_gpt_action_tasks`: 3

Aggregator:
- `cloud_zone_activity_summary`: 0

## Runtime vs Docker Mismatch

The running `3002` app is snapshot-backed:
- API `/api/rooms` returns 30 rooms; Docker has 120.
- API `/api/zones` returns 20 zones; Docker has 80.
- API `/api/floors` returns 16 floors; Docker has 4.
- API `/api/gpt/actions` returns 0 actions; Docker has 3.
- API `/api/school-ai-signals/signals` returns a capped 500 signals; Docker has 19642.
- API `/api/school-ai-signals/batches` returns 0 batches; Docker has 45.

This means UI/API checks are not validating the Docker-backed path yet. They validate the snapshot/runtime state.

## Database Gaps

1. `3002` is not DB-enabled.
   - No `.env.local` is loaded with `DATABASE_URL` and `SCHOOL_INTELLIGENCE_DB=1`.
   - `/api/school-db/status` reports Postgres disabled.

2. Snapshot data and Docker data have drifted.
   - Foundation counts differ for floors, zones, and rooms.
   - GPT action tasks and AI signal batches exist in Docker but not in the runtime API/UI.

3. Aggregator table is empty.
   - `cloud_zone_activity_summary` has 0 rows.
   - `/api/school-db/status` reports cloud zone activity unavailable.

4. Migration metadata differs across local Docker vs clean source-created DBs.
   - Docker has `applied_at bigint`.
   - Source creates `TIMESTAMPTZ`, with compatibility handling for bigint.
   - This is compatible now, but should stay documented for reproducibility.

5. DB acceptance has not been proven with snapshot disabled.
   - Need a server run with DB env enabled, and preferably a DB-only/snapshot-off verification pass, before declaring DB readiness.

## DB-Backed Acceptance Criteria

Before calling School Management DB-backed:
- `3002` process loads `DATABASE_URL=postgresql://vms:vms@localhost:5432/vms`.
- `3002` process loads `SCHOOL_INTELLIGENCE_DB=1`.
- `/api/school-db/status` returns `postgres.configured=true`.
- `/api/school-db/status` reports the expected migration files.
- Foundation endpoints return Docker counts or intentionally scoped DB counts.
- School Management UI agrees with API counts on cameras, mappings, rooms, zones, timetable, calendar, and roster.

Before calling School Intelligence DB-backed:
- Rules, events, signals, batches, workers, summaries, scores, recommendations, and actions read from Postgres.
- `/api/gpt/actions` reflects `school_gpt_action_tasks` or the UI clearly explains why no runtime actions are visible.
- Daily summary and score pages still render with snapshot disabled.
- `cloud_zone_activity_summary` is either populated or explicitly out of scope.
- `OPENAI_API_KEY` is configured only when live GPT should be verified; otherwise GPT pages should be labeled demo/snapshot-backed.

## Recommended Database Fix Order

1. Start `3002` with DB env loaded.
2. Confirm `/api/school-db/status` flips to Postgres configured.
3. Re-run a read-only endpoint count sweep and compare against Docker.
4. Decide whether snapshot should stay enabled as fallback or be disabled for DB acceptance.
5. Reconcile rooms/zones/floors counts between Docker and runtime.
6. Make GPT actions/recommendations read consistently from the chosen runtime source.
7. Make AI signal batches read consistently from the chosen runtime source.
8. Populate or intentionally exclude `cloud_zone_activity_summary`.
9. Run school UI smoke checks again after DB-backed mode is active.
