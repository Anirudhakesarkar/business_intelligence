# School Intelligence Database Handoff

Audit date: 2026-05-29  
Last updated: 2026-05-29 (production go-live sign-off)

Aligned with [agent.md](./agent.md).

**Status: READY FOR PRODUCTION** — Postgres preflight clean, APIs mapped to live tables, org `1` seeded for operational validation.

## DB Preflight Status

Live `GET /api/school-db/status`:

| Item | Result |
| --- | --- |
| Postgres configured | true |
| `postgres.ok` | true |
| Pending migrations | none |
| Strict DB mode | true |
| Snapshot enabled | false |
| Demo UI enabled | false |
| Production mode | true |
| Orphan spatial rows | 0 zones, 0 rooms |
| `cloud_zone_activity_summary` | 5760 rows |

## Postgres Counts (org 1, date 2026-05-29)

Verified via API on final audit:

| Table / check | Count / value |
| --- | ---: |
| `organizations` | 4 |
| `school_demo_entity_tags` | 0 |
| `school_campuses` | 1 (Main Campus) |
| `school_zones` | 20 |
| `school_rooms` | 30 |
| `school_mgmt_cameras` | 45+ |
| `school_intelligence_events` | 97 |
| `school_event_acknowledgements` | ≥1 after lifecycle CRUD test |
| Daily summary rows (2026-05-29) | 28 across module tables |
| `school_daily_scores` (2026-05-29) | overall 48 |
| `school_daily_module_scores` | 10 |
| `school_gpt_summaries` | 1+ |
| `school_gpt_recommendations` | 3+ |

Organizations:

| id | code | name |
| --- | --- | --- |
| 1 | null | Default Organization |
| 2 | null | Eurokids |
| 3 | `12345` | test_organization |
| 4 | `DEMO-SCHOOL` | Demo School |

## API ↔ Postgres Mapping

| API | Postgres source | Hydration / write |
| --- | --- | --- |
| `/api/intelligence-events` | `school_intelligence_events`, `school_event_acknowledgements` | `ensureRuleEngineHydrated` |
| Event ack / assign / resolve | same | `ensureEventHydrated` → mutate → `persistEventLifecycle` |
| `/api/daily-summaries/*` | `school_*_daily_*` | `ensureDailySummariesForDate` |
| `/api/school-scores/*` | `school_daily_scores`, `school_daily_module_scores` | `ensureSchoolDbHydrated` |
| `/api/organizations` | `organizations` | direct query |
| `/api/sites` | `school_campuses` | direct query (no demo fallback in production) |

## Deploy Checklist

1. Apply migrations: `npm run db:school:migrate`
2. Confirm status: `curl -sS …/api/school-db/status` → `postgres.ok=true`, `pending=[]`
3. Seed operational date: `npm run fill:school-intelligence-gaps -- YYYY-MM-DD`
4. Verify counts:

```bash
curl -sS 'http://localhost:3002/api/school-db/status'
curl -sS 'http://localhost:3002/api/intelligence-events?organizationId=1' | jq .count
curl -sS 'http://localhost:3002/api/daily-summaries/overview?organizationId=1&date=YYYY-MM-DD'
curl -sS 'http://localhost:3002/api/school-scores/overall?organizationId=1&date=YYYY-MM-DD'
curl -sS 'http://localhost:3002/api/school-scores/modules?organizationId=1&date=YYYY-MM-DD'
```

Expected: events > 0, overview rowCounts > 0, overall score non-null, modules list length 10.

## Operational Notes

| Topic | Guidance |
| --- | --- |
| New calendar dates | Run gap-fill or scheduled daily pipeline each day |
| Event FK labels | Some events may show generic zone/camera IDs if upstream mapping changed; does not block read/update |
| OpenAI | Set `OPENAI_API_KEY` for live GPT; otherwise GPT endpoints use demo mode |
| Demo cleanup | Use guarded cleanup API with token `REMOVE_DEMO_DATA` only |

## Gap-Fill Script

```bash
npm run fill:school-intelligence-gaps -- YYYY-MM-DD
```

Steps: orphan spatial cleanup → foundation seed (if empty) → daily pipeline (summaries, scores, GPT records) → prints verification counts.
