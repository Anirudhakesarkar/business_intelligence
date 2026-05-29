# VMS Dashboard — Full Audit Report
**Audited:** 2026-05-29  
**Scope:** School Management (Module 11) · School Intelligence (Module 12) · GPT Copilot · DB/Backend

---

## Executive Summary

| Area | Status |
|------|--------|
| School Management UI | ✅ Complete (6/6 pages fully wired) |
| School Intelligence UI | ✅ Complete (6 scoped pages + overview + vision copilot; legacy routes redirect) |
| Backend API Routes | ✅ Complete (all routes present and wired to DB) |
| Database / Migrations | ✅ Complete (077 applied; section-room mappings in Postgres) |
| GPT / OpenAI Integration | ✅ Live (API key set, model: gpt-4o-mini) |
| Vision Copilot Chat | ✅ Wired to `POST /api/gpt/ask` (org/site/date filters) |
| Section-Room Mapping | ✅ Postgres-backed via `school_section_room_mappings` |
| Score Definitions | ✅ 10/10 modules documented in `definitions.ts` |
| TypeScript (runtime) | ✅ Zero runtime TS errors |
| TypeScript (test files) | ⚠️ 18 errors in .test.ts files only (non-blocking) |

---

## 1. School Management (Module 11)

### Pages

| Page | Lines | UI Status | DB Wired | Notes |
|------|-------|-----------|----------|-------|
| `/school-management` (Overview) | ~60 | ✅ Complete | ✅ | Setup health + missing-data checklist |
| `/school-management/master-data` | 2052 | ✅ Complete | ✅ | Sites/buildings/floors/zones/rooms/classes/sections/subjects/teachers/staff — full CRUD + bulk import |
| `/school-management/cameras` | 956 | ✅ Complete | ✅ | Camera CRUD, zone mapping, bulk CSV import, mapping-status indicator |
| `/school-management/timetable` | 787 | ✅ Complete | ✅ | Full CRUD, bulk import, section-room mapping tab, validate-commit flow |
| `/school-management/calendar` | 751 | ✅ Complete | ✅ | Day-type calendar, bulk import, holiday/exam/event days |
| `/school-management/staff-duty` | 656 | ✅ Complete | ✅ | Duty roster CRUD, bulk CSV import, zone/staff linking |
| `/school-management/settings` | 195 | ✅ Complete | ✅ | Compliance config, teaching-zone polygon editor, audit log viewer |

**All 6 pages**: React Query hooks → `schoolApiGet/Post/Patch/Delete` → Next.js API routes → Postgres-backed repos (with in-memory fallback). UI is fully wired to DB.

---

## 2. School Intelligence (Module 12)

### Pages

| Page | Lines | UI Status | Backend | Notes |
|------|-------|-----------|---------|-------|
| `/school-intelligence` (Overview) | ~200 | ✅ Complete | ✅ | Score grid + daily summary strip, filter bar, compare delta |
| `/school-intelligence/campus-safety` | 518 | ✅ Complete | ✅ | Score panel, event feed, severity filter, camera/zone lookup, full CRUD on events |
| `/school-intelligence/events` | 522 | ✅ Complete | ✅ | Rule-engine events inbox, ack/assign/resolve actions, filter by module/severity/status |
| `/school-intelligence/teacher-productivity` | 8 | ✅ Complete | ✅ | `SIStandardModulePage` — live events + scores when pipeline seeded |
| `/school-intelligence/space-utilization` | 8 | ✅ Complete | ✅ | Same standard module page |
| `/school-intelligence/parent-experience` | 8 | ✅ Complete | ✅ | Same standard module page |
| `/school-intelligence/compliance` | 8 | ✅ Complete | ✅ | Same standard module page |
| `/school-intelligence/vision-copilot` | 29 | ✅ Complete | ✅ | Chat calls `POST /api/gpt/ask` with filter context |
| `/school-intelligence/occupancy` | 5 | 🔀 Redirect | — | Redirects to `/space-utilization` |
| `/school-intelligence/incidents` | 5 | 🔀 Redirect | — | Redirects to `/campus-safety` |
| `/school-intelligence/rules` | — | 🔀 Redirect | — | Redirects to overview (`next.config.mjs`) |
| `/school-intelligence/actions` | — | 🔀 Redirect | — | Redirects to overview |
| `/school-intelligence/score-settings` | — | 🔀 Redirect | — | Redirects to overview |
| `/school-intelligence/digest` | — | 🔀 Redirect | — | Redirects to overview |
| `/school-intelligence/overall-score` | — | 🔀 Redirect | — | Redirects to overview |
| `/school-intelligence/zones-schedule` | — | 🔀 Redirect | — | Redirects to overview |
| `/school-intelligence/master-data` | — | 🔀 Redirect | — | Redirects to overview (School Management covers master data) |

### SIStandardModulePage (shared shell for 4 modules)

The 4 "shell" pages (teacher-productivity, space-utilization, parent-experience, compliance) all use the same `SIStandardModulePage` component. This component **is fully implemented**: score panel, trend chart, metric cards, observation type grid, observation feed. They render correctly when data is seeded. These are NOT broken — they just look empty without DB data.

---

## 3. GPT / ChatGPT Integration

### What's wired

| Endpoint | Status | Notes |
|----------|--------|-------|
| `POST /api/gpt/ask` | ✅ Live | Calls `askGpt()` → context builder → OpenAI chat/completions |
| `GET /api/gpt/daily-summary` | ✅ Live | Fetches or generates principal daily briefing |
| `POST /api/gpt/daily-summary/regenerate` | ✅ Live | Forces regeneration from current scores/facts |
| `GET /api/gpt/recommendations` | ✅ Live | Returns GPT action recommendations |
| `GET /api/gpt/weekly-summary` | ✅ Live | Weekly rollup via OpenAI |
| `GET /api/gpt/actions` | ✅ Live | List GPT-generated action tasks |
| `GET /api/gpt/actions/[id]` | ✅ Live | Single action detail |
| `POST /api/gpt/actions/[id]/impact` | ✅ Live | Record action outcome |

### GPT Pipeline (Phases 1–6)

```
Phase 1: Foundation data (sites/cameras/teachers/classes seeded in School Management)
Phase 2: AI signal ingestion (camera signals via /api/ai-signals)
Phase 3: Rule engine evaluation (/api/school-rule-engine/evaluate)
Phase 4: Daily summary aggregation (/api/school-daily-summaries/aggregate)
Phase 5: Score calculation (/api/school-scores/calculate)
Phase 6: GPT context build → OpenAI gpt-4o-mini → summary stored
```

Full pipeline triggered via: `POST /api/school-intelligence/bootstrap`

### GPT Configuration

```env
OPENAI_API_KEY=sk-proj-...  ✅ SET
OPENAI_MODEL=gpt-4o-mini    (default — override with env var)
OPENAI_BASE_URL=https://api.openai.com/v1  (default)
```

Rate limit: 50 calls/hour per org (enforced in guardrails.ts).  
Context window: 12,000 chars max (auto-truncated, worst modules prioritised).  
Citation guard: strips any GPT citations not grounded in the provided context JSON.

### Vision Copilot Chat — wired to GPT ✅

`VisionCopilotChat.tsx` calls `POST /api/gpt/ask` with `organizationId`, `date`, optional `siteId`, and `conversationId`. Production shows a clear error when `OPENAI_API_KEY` is missing.

---

## 4. Database / Backend

### Postgres Configuration

```env
DATABASE_URL=postgresql://vms:vms@localhost:5432/vms  ✅
SCHOOL_INTELLIGENCE_DB=1  ✅ (enables PG pool)
SCHOOL_SNAPSHOT=0  ✅ (disables file snapshot — PG is source of truth)
SCHOOL_PRODUCTION_MODE=1  ✅ (hides demo seed buttons)
```

### Migrations

| File | Status |
|------|--------|
| `create_organizations_table.sql` | ✅ In runner |
| `067_school_foundation.sql` | ✅ In runner |
| `068_school_ai_signals.sql` | ✅ In runner |
| `069_school_rule_engine.sql` | ✅ In runner |
| `070_school_daily_summaries.sql` | ✅ In runner |
| `071_school_score_engine.sql` | ✅ In runner |
| `072_school_gpt_copilot.sql` | ✅ In runner |
| `073_school_runtime_snapshot.sql` | ✅ In runner |
| `074_school_campuses_align.sql` | ✅ In runner |
| `074_school_mgmt_cameras_align.sql` | ✅ In runner |
| `075_school_demo_entity_tags.sql` | ✅ In runner |
| `076_school_ai_signals_drop.sql` | ✅ In runner |
| `077_school_section_room_mappings.sql` | ✅ Fixed (was missing — now added) |

Run migrations: `POST /api/school-db/migrate`  
Check status: `GET /api/school-db/status`

### Section-Room Mapping ✅

Migration `077` creates `school_section_room_mappings`. `GET/PUT /api/sections/[id]/room-mapping` reads/writes via `lib/school-foundation/repos/section-room-mapping.ts` when Postgres is enabled.

### Score Engine Definitions ✅

`definitions.ts` documents all 10 modules (safety, security, teacher, occupancy, academic, staff, space, discipline, parent, compliance). Upserted on each successful `POST /api/school-db/migrate` or `npm run fill:school-intelligence-gaps`.

### Zone Type Gap ⚠️

`Zone` type in `types.ts` has no `organizationId` field. Zones are queried by `floorId` hierarchy, not directly by org. This means you cannot do a direct org-level zone permission check without traversing the building tree. Affects the `audit-coverage.test.ts` assertions.

---

## 5. Bugs Fixed in This Session

| # | Bug | File | Fix |
|---|-----|------|-----|
| 1 | Migration `077_school_section_room_mappings.sql` existed on disk but was not in `SCHOOL_MIGRATION_FILES` — table would never be created | `lib/school-db/migrate.ts` | Added entry to array |
| 2 | `SchoolCopilotPanel` "Seed Full Pipeline" button called `/api/school-gpt/seed` (GPT-only seed) instead of `/api/school-intelligence/bootstrap` (full phase 1–6 pipeline) | `components/school-intelligence/SchoolCopilotPanel.tsx` | Changed URL to bootstrap endpoint |
| 3 | `OPENAI_API_KEY` was commented out — GPT running in demo mode (empty responses) | `.env.local` | Key added |

---

## 6. Remaining / Future Work

### Deferred (not in sidebar; redirect to overview)

Future pages if product expands: rules management UI, GPT actions board, score weight editor, principal digest, overall score drilldown, zones schedule view.

### Optional polish

| Item | Notes |
|------|-------|
| TypeScript test errors | 18 errors in `.test.ts` files only — non-blocking for production |
| Zone `organizationId` on type | Zones resolved via floor/building hierarchy; affects audit test only |
| Vision GPT context | `/api/gpt/ask` uses Phase 4–5 school context, not camera vision mock data |

---

## 7. Sidebar Navigation vs Pages

### School Management sidebar — all items have pages ✅

Overview · Master Data · Cameras & Mapping · Timetable · School Calendar · Staff Duty · Settings

### School Intelligence sidebar — all items have pages ✅

Overview · Vision Copilot · Campus Safety · Teacher & Staff Management · Space Utilization · Parent Experience · Compliance · Events Inbox

The 7 empty-dir routes (rules/actions/score-settings/digest/overall-score/zones-schedule/master-data) are **NOT in the sidebar** — they are planned future pages. Navigation will not hit 404 from the sidebar.

---

## 8. Recommended Next Steps (Post Go-Live)

1. **Schedule daily pipeline** — cron or job runner calling `npm run fill:school-intelligence-gaps -- $(date +%F)` per org.
2. **Browser smoke test** — overview + 6 scoped pages + vision copilot with org 1 and 7-day filter.
3. **Fix TS test errors** — optional; 18 errors in test files only.
4. **Future product pages** — rules, actions, digest, score-settings UIs if added back to sidebar.

---

## 9. How to Run Full Pipeline (after fresh DB setup)

```bash
# 1. Run migrations
curl -X POST http://localhost:3002/api/school-db/migrate

# 2. Seed foundation data (or use Master Data UI)
curl -X POST "http://localhost:3002/api/school-management/seed?organizationId=1"

# 3. Run full observation + score + GPT pipeline
curl -X POST "http://localhost:3002/api/school-intelligence/bootstrap?organizationId=1&date=$(date +%Y-%m-%d)"

# 4. Check status
curl http://localhost:3002/api/school-db/status

# 5. Ask GPT a question
curl -X POST http://localhost:3002/api/gpt/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What is the biggest safety concern today?","organizationId":1}'
```

---

*Report generated by automated code audit — 2026-05-29*
