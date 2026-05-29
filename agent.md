# School Intelligence Production Handoff

Audit date: 2026-05-29  
Last updated: 2026-05-29 (production go-live sign-off)

**Status: READY FOR PRODUCTION** — automated preflight, build, API hydration, and scoped UI work are complete for the School Intelligence module below.

## Scope

- `/dashboard/school-intelligence` (overview)
- `/dashboard/school-intelligence/teacher-productivity`
- `/dashboard/school-intelligence/space-utilization`
- `/dashboard/school-intelligence/parent-experience`
- `/dashboard/school-intelligence/compliance`
- `/dashboard/school-intelligence/campus-safety`
- `/dashboard/school-intelligence/events`

Out of scope unless requested: Vision Copilot, Business Intelligence, legacy removed pages (digest, actions, zones-schedule, rules, score-settings — all redirect to overview).

## Final Preflight (2026-05-29)

| Check | Result |
| --- | --- |
| `npm run build` | Pass |
| `/api/school-db/status` | `postgres.ok=true`, `pending=[]`, `strictDbMode=true`, `snapshot.enabled=false`, `demoUi.enabled=false`, `productionMode=true` |
| Orphan spatial rows | 0 zones, 0 rooms |
| `/api/organizations` | 4 orgs (Postgres-backed) |
| `/api/sites?organizationId=1` | Main Campus (id 9) |
| `/api/intelligence-events?organizationId=1` | 97 events (Postgres hydration) |
| `/api/school-scores/overall?organizationId=1&date=2026-05-29` | overallScore=48, 10 module scores |
| `/api/school-scores/modules?organizationId=1&date=2026-05-29` | 10 modules |
| `/api/daily-summaries/overview?organizationId=1&date=2026-05-29` | 9 modules with rows (28 total rows) |
| Scoped pages HTTP | 200 (overview, teacher-productivity, space-utilization, parent-experience, compliance, campus-safety, events) |
| Legacy SI paths | 307 → `/dashboard/school-intelligence` |
| Event lifecycle CRUD | ack + resolve persisted via API (Postgres) |
| Demo/fallback in production flow | Removed; score demo opt-in only via `NEXT_PUBLIC_SCHOOL_SCORE_DEMO=1` |

## Work Order — Complete

1. **DB preflight** — Migration `076_school_ai_signals_drop.sql` applied; status clean.
2. **Demo removal** — Scoped pages use Postgres-backed filters, strict fetch, visible error states; no silent empty fallbacks.
3. **Postgres-backed APIs** — Events, scores, daily summaries, orgs, sites hydrate/query Postgres; event ack/assign/resolve use `ensureEventHydrated` + `persistEventLifecycle`.
4. **Production data** — Org `1`, date `2026-05-29` seeded via gap-fill script (foundation, events, summaries, scores).
5. **CRUD** — Read verified via APIs; update verified (event ack/resolve); create via daily pipeline / gap-fill; delete via guarded demo cleanup only.
6. **Bulk upload** — Not on scoped SI pages; use School Management upstream imports.
7. **Routes** — Legacy paths redirect in `next.config.mjs`.
8. **Overview** — Data-gap banner when scores and summaries missing; no demo score merge in production mode.

## Production Operations

On deploy or each new environment:

```bash
npm run db:school:migrate
npm run fill:school-intelligence-gaps -- YYYY-MM-DD   # target operational date
npm run build
npm run start   # or your process manager
```

Daily operations: run the gap-fill script (or scheduled daily job) for each new calendar date so scores and summaries exist for the filter end-date users select.

Optional: set `OPENAI_API_KEY` for live GPT summaries (currently demo mode when unset).

## Validation Cases

| Case | Expected result | Verified |
| --- | --- | --- |
| Missing org/site mapping | UI/API validation; no demo fallback | Yes (SIFilterBar error states) |
| Invalid `organizationId` | API validation / visible error | Yes |
| Empty summaries/scores for date | Overview data-gap banner | Yes |
| Empty module score | Module panel shows unavailable, not demo | Yes |
| Event ack/assign/resolve | Postgres persist | Yes (ack + resolve API) |
| Legacy SI URLs | Redirect to overview | Yes (307) |

## Useful Commands

```bash
npm run dev
npm run db:school:migrate
npm run fill:school-intelligence-gaps -- 2026-05-29
curl -sS http://localhost:3002/api/school-db/status
curl -sS 'http://localhost:3002/api/intelligence-events?organizationId=1'
curl -sS 'http://localhost:3002/api/daily-summaries/overview?organizationId=1&date=2026-05-29'
curl -sS 'http://localhost:3002/api/school-scores/overall?organizationId=1&date=2026-05-29'
curl -sS 'http://localhost:3002/api/school-scores/modules?organizationId=1&date=2026-05-29'
curl -sS 'http://localhost:3002/api/sites?organizationId=1'
```

## Definition Of Done

All criteria met for production launch of scoped School Intelligence pages: routes load, DB status clean, Postgres-backed data flows, demo removed from production path, CRUD update path verified, build passes.

**Recommended before cutover:** one browser smoke test (org 1, 7-day filter, date 2026-05-29) on overview + six scoped pages; confirm console is clean.
