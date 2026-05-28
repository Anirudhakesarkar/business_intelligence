# School Modules Dashboard (School Management + School Intelligence)

This is a standalone Next.js dashboard that hosts two modules:

- **School Management (Foundation)**
- **School Intelligence (Insights)**

The goal is to let staff/admins configure a school “digital twin” (management), then compute intelligence outputs (events, daily summaries, scores, GPT explanations), and also support BI-style analytics.

---

## Tech stack (what this repo is)

- **Frontend**: **Next.js** (React) dashboard (this repo).
- **Backend**: **Node.js** API server (separate service in `vision/server` in the main monorepo).
- **Database**: **Postgres SQL**.

This README is intentionally detailed because we use it as a **handoff spec for Codex** (so Codex can implement/extend features without guessing the flows).

---

## Goal: ChatGPT (LLM) answers grounded in DB data

We want to plug in an **OpenAI / ChatGPT API key** and let users ask questions in the UI that are answered using the **data we already store**.

This “AI Copilot” experience is a **submodule**: it only works well if the upstream submodules (Master Data, Timetable, Cameras/Mapping, Signals, Rules, Summaries, Scores, Aggregator sync) are working correctly and consistently writing correct data.

### Data sources to ground on

- **Aggregator summaries (Edge BI sync)**:
  - Cloud Postgres table: `cloud_zone_activity_summary`
  - This is the 5‑minute “aggregator simulator” output (see the Aggregator section below).
- **School modules data (Foundation + Intelligence)**:
  - Master data (campus, classes, staff, cameras)
  - Timetable, calendar, staff duty
  - Intelligence rules/events, daily summaries, scores
  - GPT outputs storage tables (when enabled)

### Intended flow (high level)

1. **User asks a question** in the dashboard UI.
2. The dashboard calls a **Next.js API route** (BFF) like `POST /api/gpt/ask` (exists today for “copilot” style Q&A).
3. The API builds a **grounding context** from Postgres (aggregator + school modules data), applies guardrails (row limits / context truncation / rate limits), then calls the **OpenAI API**.
4. The UI renders the answer and (optionally) the supporting context/query results.

### What’s “ready” vs “planned”

- **Ready (existing copilot)**: endpoints under `app/api/gpt/*` support Q&A + summaries. Live answers require `OPENAI_API_KEY`.
- **Planned (BI-style analysis over arbitrary DB tables)**: a tool-calling loop where the model proposes SQL and the server runs it read-only with strict guards (not implemented yet; see “Not ready” notes later).

---

## Current runtime mode (important)

This project can run in two modes:

- **Mock mode (no backend / no DB)**: `NEXT_PUBLIC_USE_MOCK_DATA=true`
- **DB-backed mode (later, separate DB)**: set `DATABASE_URL` + `SCHOOL_INTELLIGENCE_DB=1`

Right now we intentionally **do not point to the main project DB**. See `.env.local`.

---

## Module map (pages)

### School Management (Foundation)

Route group: `app/(dashboard)/dashboard/school-management/*`

- **Overview**: `/dashboard/school-management`
- **Master Data**: `/dashboard/school-management/master-data`
- **Cameras & Mapping**: `/dashboard/school-management/cameras` and `/dashboard/school-management/cameras/[id]`
- **Timetable**: `/dashboard/school-management/timetable`
- **School Calendar**: `/dashboard/school-management/calendar`
- **Staff Duty**: `/dashboard/school-management/staff-duty`
- **Signals**: `/dashboard/school-management/signals`
- **Workers**: `/dashboard/school-management/workers`
- **AI Health**: `/dashboard/school-management/ai-health`
- **Settings**: `/dashboard/school-management/settings`

### School Intelligence (Insights)

Route group: `app/(dashboard)/dashboard/school-intelligence/*`

- **Overview**: `/dashboard/school-intelligence`
- **Master Data Setup**: `/dashboard/school-intelligence/master-data`
- **Overall Score**: `/dashboard/school-intelligence/overall-score`
- **Gate Flow**: `/dashboard/school-intelligence/gate-flow`
- **Academic Operations**: `/dashboard/school-intelligence/academic-operations`
- **Zones & Schedule**: `/dashboard/school-intelligence/zones-schedule`
- **Events Inbox**: `/dashboard/school-intelligence/events` and `/dashboard/school-intelligence/events/[id]`
- **Rules**: `/dashboard/school-intelligence/rules`
- **Score Settings**: `/dashboard/school-intelligence/score-settings`
- **Actions / Digest / Safety / Compliance / Staffing / Utilization**: the remaining pages under `school-intelligence/*`

---

## School Management (Foundation) — readiness by submodule

The School Management module is the “source of truth” for **where / who / what should happen**:

- **Where**: sites → buildings → floors → zones → rooms
- **Who**: teachers, staff
- **What should happen**: timetable, calendar, staff duty
- **Camera attribution**: mapping cameras to zones/rooms and governance fields

### Master Data (Ready when DB enabled; mock mode shows UI only)

- **UI**: `app/(dashboard)/dashboard/school-management/master-data/page.tsx`
- **Component inventory (every UI piece on this page)**:
  - **Shell/header**: `SMPageHeader`
  - **Tabs**: `SMTabs`
  - **Bulk import**: `BulkImportButton`
  - **Campus read-only tree**: `CampusTreeView`
  - **Seed + health hooks**: `useSeedDemo`, `useSetupHealth`
  - **Tables**:
    - In-page `ETable` wrapper (ID + selection + bulk delete controls)
    - `DataTable` (shared table renderer)
  - **Sheets (side panels)**: `Sheet` (used for create/edit forms across entities)
  - **UI atoms**: `Button` (+ icons `Database`, `CheckCircle2`, `AlertTriangle`, `Loader2`)
- **Logic (TL;DR)**
  - This page is a **single “master data console”** that manages multiple entity types (tabs) using React Query + Next.js API routes.
  - Entities are **hierarchical** (site → building → floor → zone → room) plus **org entities** (classes/sections/subjects/teachers/staff).
  - Many downstream features (timetable, mapping, intelligence) assume these entities exist and are named consistently.
- **Key edge cases**
  - In **mock mode** (`SCHOOL_INTELLIGENCE_DB=0`), the UI renders but **persistence is not guaranteed** (intended for UI development only).
  - Parent/child relationships must be valid (e.g., building must reference an existing site).
  - CSV import ordering matters (parents before children).
- **Source of truth (code)**
  - UI: `app/(dashboard)/dashboard/school-management/master-data/page.tsx`
  - API: `app/api/{sites,buildings,floors,zones,rooms,classes,sections,subjects,teachers,staff-members}/*`
  - Bulk import: `app/api/master-data/bulk-import/route.ts`
  - Repos: `lib/school-foundation/repos/*`
- **Status**:
  - **Ready**: UI + API layer + DB repos exist
  - **Not ready**: meaningful data persistence when `SCHOOL_INTELLIGENCE_DB=0` (mock mode)
- **UI text inventory (exact labels)**
  - **Page title**: **Master Data**
  - **Subtitle text**: “Campus hierarchy, rooms, classes, subjects, teachers, and staff — foundation for all intelligence modules.”
  - **Header actions**: **Bulk import**, **Seed demo data** (loading: **Seeding…**)
  - **Tab labels**: Sites, Buildings, Floors, Zones, Rooms, Classes & Sections, Subjects, Teachers, Staff, Campus Tree
  - **Common controls**:
    - Search placeholder: “Search…”
    - Button: **Export CSV**
    - Bulk bar: “N selected”, **Clear**, **Delete selected (N)** (loading: **Deleting…**)
    - Empty states: “No records yet.” and “Use the "Seed demo" button above or add entries manually.”
  - **Common “Add” buttons**: **+ Add Site**, **+ Add Building**, **+ Add Floor**, **+ Add Zone**, **+ Add Room**, **+ Add Class**, **+ Add Section**, **+ Add Subject**, **+ Add Teacher**, **+ Add Staff**
  - **Common sheet actions**: **Cancel**, **Save** / **Saving…**, plus create labels like **Create site** / **Save changes**
- **Buttons and flows**
  - **CRUD (Sites/Buildings/Floors/Zones/Rooms/Classes/Sections/Subjects/Teachers/Staff)**
    - **Endpoints** (working when DB enabled):
      - `/api/sites` + `/api/sites/[id]`
      - `/api/buildings` + `/api/buildings/[id]`
      - `/api/floors` + `/api/floors/[id]`
      - `/api/zones` + `/api/zones/[id]`
      - `/api/rooms` + `/api/rooms/[id]`
      - `/api/classes` + `/api/classes/[id]`
      - `/api/sections` + `/api/sections/[id]`
      - `/api/subjects` + `/api/subjects/[id]`
      - `/api/teachers` + `/api/teachers/[id]`
      - `/api/staff-members` + `/api/staff-members/[id]`
    - **DB tables** (when DB enabled):
      - `school_sites`, `school_buildings`, `school_floors`, `school_zones`, `school_rooms`
      - `school_classes`, `school_sections`, `school_subjects`
      - `school_teachers`, `school_staff_members`
  - **Section → Room mapping**
    - **Endpoint**: `/api/sections/[id]/room-mapping`
    - **DB tables**: `school_sections`, `school_rooms` (mapping fields stored in section)
  - **Bulk import (CSV)**
    - **Endpoint**: `POST /api/master-data/bulk-import` (multipart field name: `file`)
    - **DB tables**: same as above (imports in dependency order)
    - **Status**: **Ready when DB enabled**
  - **Seed demo data**
    - **Endpoint**: `POST /api/school-management/seed`
    - **DB tables**: master data tables above + any seed helpers
    - **Status**: **Ready when DB enabled**
  - **Setup health / missing data**
    - **Endpoints**:
      - `GET /api/school-management/setup-health`
      - `GET /api/school-management/missing-data`
    - **Status**: **Ready when DB enabled**

### Timetable (Ready when DB enabled; supports CSV validate → commit)

- **UI**: `app/(dashboard)/dashboard/school-management/timetable/page.tsx`
- **Component inventory**:
  - **Header**: `SMPageHeader`
  - **Sheets**:
    - `AddEntrySheet` (in-page component, rendered via `Sheet`)
    - `ImportSheet` (in-page component, rendered via `Sheet`)
  - **UI atoms**: `Button`, `Loader2`
- **Logic (TL;DR)**
  - Timetable is stored as **normalized entries** (per period/day/section/room/teacher/subject).
  - CSV import uses a **2-step pipeline**: **validate/preview** first, then **commit** if valid.
  - Views support filtering by **Class (grade)** and **Section** so staff can see the correct schedule.
- **Key edge cases**
  - Validation rejects rows when referenced entities don’t exist (room/teacher/subject/class/section mismatch).
  - Conflicts/overlaps (e.g., room overlap) are detected during validation and/or rendering depending on policy.
  - “Seed sample timetable” replaces existing entries after user confirmation.
- **Source of truth (code)**
  - UI: `app/(dashboard)/dashboard/school-management/timetable/page.tsx`
  - Import/validation logic: `lib/school-foundation/repos/timetable-import.ts`
  - Sample seed: `lib/school-foundation/repos/timetable-sample.ts`
  - API: `app/api/timetable/*`
- **Key flows**
  - **List / view timetable**:
    - **Endpoint**: `GET /api/timetable` and `GET /api/timetable/[id]`
    - **DB table**: `school_timetable_entries`
  - **Import CSV (2-step)**:
    - **Validate**: `POST /api/timetable/validate-import`
    - **Commit**: `POST /api/timetable` (after preview)
    - **DB table**: `school_timetable_entries`
  - **Load sample timetable**
    - **Endpoint**: `POST /api/timetable/seed-sample`
    - **Behavior**: replaces org timetable after confirmation
    - **DB table**: `school_timetable_entries`
- **Status**
  - **Ready**: validate + import + sample seeding exist
  - **Not ready in mock-only mode**: persistent timetable storage (DB disabled)
- **UI text inventory (exact labels)**
  - **Page title**: **Timetable**
  - **Subtitle text**: “Class schedules mapped to rooms and teachers. Overlap detection included.”
  - **Header buttons**: **Load sample schedule** (loading: **Loading…**), **Import CSV**, **+ Add Entry**
  - **Confirm**: “This replaces all timetable entries with a small sample (Grade 1 A/B, Grade 2 A). Continue?”
  - **No-data banner**: “No timetable yet” with steps referencing **Seed demo data**, **Load sample schedule**, **Import CSV**, and link “sample file”
  - **Filters**: “Class (grade)” (default “All classes”), “Section” (default “All sections” / “All sections in class”), **Clear filters**
  - **View tabs**: Weekly Grid, By Section, By Teacher, By Room
  - **Empty states**: “Loading timetable…”, “No timetable entries. Load demo seed or add entries.”, “No entries for selected teacher.”, “No entries for selected room.”, “No entries for selected section.”
  - **Add Entry sheet title**: “Add Timetable Entry” (primary button: **Add entry**, loading: **Saving…**)
  - **Import sheet title**: “Import Timetable (CSV)” (primary commit button: **Commit N entries**, loading: **Importing…**)

### Cameras & Mapping (Ready when DB enabled)

- **UI**: `app/(dashboard)/dashboard/school-management/cameras/*`
- **Component inventory (list page)**: `app/(dashboard)/dashboard/school-management/cameras/page.tsx`
  - **Header**: `SMPageHeader`
  - **Sheets**:
    - `CsvImportSheet` (in-page component, rendered via `Sheet`)
    - `CameraFormSheet` (in-page component, rendered via `Sheet`)
  - **UI atoms**: `Button`
  - **Navigation**: `next/link`
- **Component inventory (detail page)**: `app/(dashboard)/dashboard/school-management/cameras/[id]/page.tsx`
  - **Header**: `SMPageHeader`
  - **Breadcrumbs**: `SchoolAiBreadcrumbs`
  - **Data hooks**: `useCameraAiDetail`
  - **UI**: `Card`, `CardContent`
- **Logic (TL;DR)**
  - Cameras are registered for school governance and mapped to campus entities (zone/room) to make intelligence attribution possible.
  - Import/export allows bulk onboarding of camera records; mapping completeness is surfaced in the UI.
  - Several “AI detail” pages assume signals/health exist for the camera.
- **Key edge cases**
  - Some camera fields may be treated as “renderer-owned” (the UI avoids re-collecting them).
  - Missing mappings reduce intelligence quality; mapping status endpoint highlights gaps.
  - Health/signals endpoints depend on signal ingestion or seeded demo signals.
- **Source of truth (code)**
  - UI: `app/(dashboard)/dashboard/school-management/cameras/page.tsx` and `.../cameras/[id]/page.tsx`
  - API: `app/api/cameras/*`, `app/api/camera-health*`, `app/api/camera-processing-configs/*`
  - Camera repos: `lib/school-foundation/repos/foundation-cameras.ts`
- **Endpoints**
  - Camera list/CRUD: `/api/cameras` and `/api/cameras/[id]`
  - Import: `POST /api/cameras/import`
  - Mapping status: `GET /api/cameras/mapping-status`
  - Teaching zones (per camera): `/api/cameras/[id]/teaching-zones`
  - Processing config (per camera): `/api/cameras/[id]/processing-config` (+ `/defaults`)
  - Camera health: `/api/cameras/[id]/health`
  - Signals timeline/latest/freshness: `/api/cameras/[id]/signals/*` and `/freshness`
- **DB tables (when DB enabled)**
  - `school_mgmt_cameras`, `school_camera_processing_configs`
  - `school_camera_health_events`, `school_diagnostic_media`
  - `school_ai_signals` (+ derived helpers depending on endpoint)
- **UI text inventory (exact labels)**
  - **List page title**: **Cameras and Mapping**
  - **Subtitle text**: “Register cameras, assign purpose, process owner, and location. Classroom/lab cameras require a room.”
  - **Header buttons**: **Import CSV**, **+ Add Camera**
  - **Mapping status banner**: “N% mapped”, “N total cameras”, “N camera(s) missing location or purpose”, “N classroom/lab camera(s) missing room assignment”
  - **Filters**:
    - Search placeholder: “Search cameras…”
    - Purpose: “All purposes”
    - Status: “All statuses”
    - Button: **Clear**
  - **View toggle**: table, map
  - **Export**: “N of N cameras” + button **Export CSV**
  - **Empty state**: “No cameras match filters. Load demo seed or add cameras.”
  - **Table headers**: Code, Name, Purpose, Process Owner, Criticality, Status, Zone, Room, Active hrs, Actions
  - **Row actions**: **AI detail**, **Edit**
  - **Import sheet title**: “Import Cameras (CSV)” (success: “Import complete.”; primary: “Import N cameras” / “Importing…”)
  - **Camera sheet title**: **Add Camera** / **Edit Camera** (primary: **Add camera** / **Save changes**; loading: **Saving…**)
  - **Detail page title pattern**: “CAMCODE — Name” (subtitle: “Health timeline, recent signals, and processing configuration.”)
  - **Detail page links**: “← AI Health grid”, “Open signal timeline →”, “Camera mapping”
  - **Detail empty states**: “No health events recorded.”, “No processing config.”, “No batches yet.”

### School Calendar (Ready when DB enabled)

- **UI**: `app/(dashboard)/dashboard/school-management/calendar/page.tsx`
- **Component inventory**:
  - **Header**: `SMPageHeader`
  - **Sheets**: `Sheet` (CSV/ICS import preview + bulk commit)
  - **UI atoms**: `Button` (+ icons `Upload`, `FileText`, `AlertTriangle`, `CheckCircle2`, `X`, `Loader2`, `ChevronDown`, `ChevronUp`)
- **Logic (TL;DR)**
  - Calendar stores the “academic reality”: working days, holidays, special events, and schedule overrides.
  - Bulk import supports commit of many days at once after preview.
- **Key edge cases**
  - Date ranges and duplicate day entries should be merged/upserted deterministically.
  - Calendar gaps affect downstream baselines for intelligence summaries.
- **Endpoints**
  - `GET/POST /api/school-calendar`
  - `POST /api/school-calendar/bulk`
- **DB table**: `school_calendars`
- **UI text inventory (exact labels)**
  - **Page title**: **School Calendar**
  - **Subtitle text**: “Working days, holidays, exams, and special schedules. Upload a .ics or .csv file to import in bulk.”
  - **Header buttons**: **Upload Calendar**, **Bulk Mark**
  - **View tabs**: Month View, Heat Summary, List View
  - **Month nav buttons**: “‹” and “›”
  - **Loading**: “Loading calendar…”
  - **List table headers**: Date, Day type, Label, Actions (row action: **Edit**)
  - **List empty state**: “No calendar entries yet. Use Upload Calendar or click any day to add.”
  - **Upload sheet title**: “Upload Calendar”
  - **Upload sheet errors**:
    - “Unsupported file type. Please upload an .ics or .csv file.”
    - “No valid events found. Make sure dates are in YYYY-MM-DD or DD/MM/YYYY format.”
    - “Failed to parse file. Please check the format and try again.”
  - **Upload sheet preview**:
    - “N events detected — classified automatically”
    - Buttons: “Show fewer”, “Show all N events”
    - Placeholder: “Event name”
    - Footer: **Cancel**, “Import N events” / **Importing…**
  - **Upload sheet success**: “Import complete!” and “N calendar entries saved.”

### Staff Duty (Ready when DB enabled)

- **UI**: `app/(dashboard)/dashboard/school-management/staff-duty/page.tsx`
- **Component inventory**:
  - **Header**: `SMPageHeader`
  - **Sheets**: `Sheet` (import / edit / bulk actions)
  - **UI atoms**: `Button`
- **Logic (TL;DR)**
  - Staff duty rostering assigns staff coverage to zones/rooms across configured time windows.
  - Used by intelligence modules to detect “coverage gaps” during critical windows.
- **Key edge cases**
  - Window overlaps and missing assignments can create ambiguous responsibility.
  - Requires master data (staff, zones/rooms) to be complete and consistent.
- **Endpoints**
  - `GET/POST /api/staff-duty-rosters`
  - Time windows: `GET/POST /api/school-time-windows`
- **DB tables**
  - `school_staff_duty_rosters`, `school_time_windows`
- **UI text inventory (exact labels)**
  - **Page title**: **Staff Duty Roster**
  - **Subtitle text**: “Gate, floor, corridor, playground, bus bay, lab, and emergency exit coverage. ⚡ marks critical windows.”
  - **Header buttons**: **Export CSV**, **Import CSV**, **+ Add Duty**
  - **Gap banner title**: “⚠ Critical window coverage gaps”
  - **Filters**: “All days”, “All duty types”, button **Clear**
  - **View toggle**: grid, list
  - **Loading**: “Loading roster…”
  - **Empty state**: “No roster entries. Load demo seed or add entries.”
  - **Import sheet title**: “Import Duty Roster (CSV)” (hint includes “Required columns: …”)
  - **Add sheet title**: “Add Duty Assignment” (primary: **Add assignment**, loading: **Saving…**)

### AI Health / Signals / Workers (Ready when DB enabled)

- **AI Health page**: `app/(dashboard)/dashboard/school-management/ai-health/page.tsx`
  - **Components**: `SMPageHeader`, `SchoolAiBreadcrumbs`, `Card`, `CardContent`, `Button`
  - **Hooks**: `useAiHealth`, `useSeedAiSignals`, `useCameras`
- **Signals page**: `app/(dashboard)/dashboard/school-management/signals/page.tsx`
  - **Components**: `SMPageHeader`, `SchoolAiBreadcrumbs`, `Card`, `CardContent`, `Button`
  - **Hooks**: `useSignalTimeline`, `useSeedAiSignals`, `useCameras`
  - **UI icons**: `Activity`, `Camera`, `Filter`, `RefreshCw`, `Cpu`
- **Workers page**: `app/(dashboard)/dashboard/school-management/workers/page.tsx`
  - **Components**: `SMPageHeader`, `SchoolAiBreadcrumbs`, `Card`, `CardContent`, `Button`
  - **Hooks**: `useAiWorkers`, `useSeedAiSignals`
  - **UI icons**: `RefreshCw`, `Cpu`, `Wifi`, `WifiOff`, `AlertTriangle`, `CheckCircle2`, `Clock`
- **Logic (TL;DR)**
  - These pages expose the operational telemetry layer: signals, worker registry/heartbeat, and health snapshots.
  - Used to verify that upstream ingestion is working before expecting intelligence outputs.
- **Key edge cases**
  - In demo environments, “seed signals” may generate synthetic data (useful for UI demos, not real operations).
  - If ingestion is down, intelligence pages may still render but will show sparse/empty data.
- **Signals endpoints**
  - `GET /api/ai-signals`
  - `POST /api/ai-signals/bulk`
  - `GET /api/school-ai-signals/batches`
- **Workers endpoints**
  - `GET/POST /api/ai-workers`
  - `POST /api/ai-workers/register`
  - `POST /api/ai-workers/[id]/heartbeat`
  - `GET /api/ai-workers/health`
- **DB tables**
  - `school_ai_signals`, `school_ai_signal_batches`
  - `school_ai_workers`, `school_ai_worker_heartbeats`
- **UI text inventory (exact labels)**
  - **AI Health**
    - **Page title**: **Cameras & AI Health**
    - **Subtitle text**: “Stream health, signal freshness, and worker summary — operational evidence only (no management scores).”
    - Buttons: **Seed demo signals**, **Refresh**, **Worker health**, **Signal timeline**
    - Empty banner: “No cameras registered. Complete Phase 1 camera mapping first, then seed AI signals.”
    - Filters: Purpose (default “All”), Criticality (default “All”), checkbox “Stale only”
    - States: “Loading health grid…”, “No cameras match filters.”
  - **Signals**
    - **Page title**: **Signal Timeline**
    - **Subtitle text**: “Ingested AI signals across cameras — filter by type, camera, date, and confidence.”
    - Buttons: **Clear**, **Refresh**, “Export CSV (max 10k)”, **Seed signals** (loading: **Seeding…**)
    - Empty state: “No signals match filters. Try seeding demo data or adjusting filters.”
  - **Workers**
    - **Page title**: **AI Workers**
    - **Subtitle text**: “Edge worker registry — heartbeat metrics and processing configuration.”
    - Buttons: “Seed workers + signals” (loading: **Seeding…**), **Refresh**
    - Empty state: “No workers registered. Seed AI signals to register demo workers.”
    - Toggle text: “▼ Show processing config” / “▲ Hide processing config”; “Heartbeat:” + “Never”

### Settings / Audit logs (Ready when DB enabled)

- **Settings endpoints**
  - `GET/POST /api/school-management/settings`
- **Component inventory (Settings page)**: `app/(dashboard)/dashboard/school-management/settings/page.tsx`
  - **Header**: `SMPageHeader`
  - **UI**: `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Button`
  - **Data**: `useSetupHealth` + `schoolFetch`
- **Audit endpoints**
  - `GET /api/school-management/audit-logs`
  - `GET /api/school-management/audit-log`
- **DB table**
  - `school_audit_logs` (+ settings tables used by repos)
- **UI text inventory (exact labels)**
  - **Page title**: **Settings**
  - **Subtitle text**: “Organization defaults, compliance checklist, teaching zones, and audit trail.”
  - **Cards**: Phase 2 readiness, Organization defaults, Compliance checklist, Teaching zones — {camera name}, Audit log
  - **Phase 2 text**: “Ready for Phase 2.” / “Complete missing items on overview.”
  - **Checkbox label**: “Strict Phase 2 gate”
  - **Field labels**: Timezone, Academic year, Timetable overlaps (options: Block, Warn only)
  - **Teaching zones fields**: “Board polygon (JSON)”, “Desk polygon (JSON)”
  - **Buttons**: **Save settings**, **Refresh**

---

## School Intelligence (Insights) — readiness by pipeline phase

School Intelligence converts:

**foundation data + AI signals → rules → events → daily summaries → scores → GPT copilot**

### UI component inventory (shared building blocks)

These components are reused across School Intelligence pages:

- **Shell/layout**
  - `SIPageShell` (sectioned page wrapper)
  - `SISection` (section container + actions + icon)
  - `SIModuleHeader` (module header hero)
  - `SchoolIntelligenceBreadcrumbs` (breadcrumbs)
- **Filtering + date**
  - `SIFilterBar` (date range / module filters)
  - `SIDatePicker` (date selector)
- **Cards**
  - `SIKPICard` (single KPI card)
  - `SIDailyTrendCard` (trend card)
- **Module views**
  - `SchoolDailyModuleView` (standard “daily module” renderer used by many pages)
- **Copilot UI**
  - `SchoolCopilotPanel` (daily summary panel)
  - `SchoolCopilotQA` (Q&A chat)
  - `SchoolRecommendationsStrip` (recommendations row)
- **Rules editor**
  - `RuleEditSheet` (create/edit rule sheet)
- **Hooks**
  - `useSchoolDailySummaries` (`useSchoolDailyOverview`, `useSchoolDailyModule`)
  - `useSchoolScores` (`useSchoolOverallScore`)
  - `useSchoolRuleEngine` (`useIntelligenceEvents`, `useIntelligenceRules`, `useSeedRuleEngine`, `useEvaluateRules`)

### Phase 3: Rules → events (Ready when DB enabled)

- **Rules endpoints**
  - `GET/POST /api/intelligence-rules`
  - `GET/PATCH/DELETE /api/intelligence-rules/[id]`
  - Notifications:
    - `GET/POST /api/intelligence-notifications`
- **Component inventory (Rules UI page)**: `app/(dashboard)/dashboard/school-intelligence/rules/page.tsx`
  - **Header**: `SMPageHeader` (shared header)
  - **Breadcrumbs**: `SchoolIntelligenceBreadcrumbs`
  - **Editor**: `RuleEditSheet`
  - **Hooks**: `useIntelligenceRules`, `useSeedRuleEngine`
  - **UI atoms**: `Button`, `Card`, `CardContent`
  - **Buttons/controls shown (names)**
    - **Seed default rules**
    - **Refresh**
    - Per-row toggle tooltip text: **Click to enable** / **Click to disable**
- **Logic (TL;DR)**
  - Rules define how low-level signals and context turn into higher-level **intelligence events** (alerts/anomalies).
  - Event lifecycle includes creation, acknowledgement, assignment, and resolution.
- **Key edge cases**
  - Rule enable/disable changes what gets evaluated; historical events may remain.
  - Evaluation is designed to be safe to re-run (idempotent or overwrite rules-based output).
- **Events endpoints**
  - `GET /api/intelligence-events`
  - `GET /api/intelligence-events/[id]`
  - `POST /api/intelligence-events/evaluate`
  - plus event actions under `/api/intelligence-events/[id]/*` (ack/assign/resolve)
- **Component inventory (Events list page)**: `app/(dashboard)/dashboard/school-intelligence/events/page.tsx`
  - **Header**: `SMPageHeader`
  - **Breadcrumbs**: `SchoolIntelligenceBreadcrumbs`
  - **Data deps**: `useCameras`, `useZones` (from School Foundation hooks)
  - **UI atoms**: `Button`, `Card`, `CardContent`
  - **Buttons/controls shown (names)**
    - **Seed rules + signals**
    - **Evaluate rules**
    - **Refresh**
    - Status filter chips: **All**, **Open**, **Acknowledged**, **Assigned**, **Resolved**
    - Bulk action buttons (when items selected): **Acknowledge selected**, **Select all open**, **Clear**
- **Component inventory (Event detail page)**: `app/(dashboard)/dashboard/school-intelligence/events/[id]/page.tsx`
  - **Shell**: `SIPageShell`, `SISection`
  - **Hook**: `useIntelligenceEvent`
  - **Mutations**: `schoolFetch` (ack/resolve/assign actions)
  - **UI atoms**: `Button`
  - **Buttons/controls shown (names)**
    - Event actions include **Acknowledge**, **Resolve**, and assignment actions (label depends on assignee UI)
- **DB tables**
  - `school_intelligence_rules`, `school_rule_conditions`
  - `school_intelligence_events`, `school_event_acknowledgements`

### Phase 4: Daily summaries (Ready when DB enabled)

- **Endpoints**
  - `GET /api/daily-summaries/overview`
  - `GET /api/daily-summaries/[module]`
  - `GET /api/daily-summaries/[module]/trend`
  - `GET /api/daily-summaries/[module]/compare`
  - `GET /api/daily-summaries/[module]/events`
- **DB tables**
  - `school_*_daily_intelligence` tables (per module)
  - `school_runtime_snapshots` (optional)

### Component inventory (daily module pages)

Most module pages are thin wrappers around `SchoolDailyModuleView`:

- `app/(dashboard)/dashboard/school-intelligence/gate-flow/page.tsx`
- `.../academic-operations/page.tsx`
- `.../compliance/page.tsx`
- `.../discipline/page.tsx`
- `.../parent-experience/page.tsx`
- `.../staff-deployment/page.tsx`
- `.../space-utilization/page.tsx`
- `.../student-occupancy/page.tsx`
- `.../teacher-productivity/page.tsx`
- `.../teacher-supervision/page.tsx`

These pages typically use:

- `Card`, `CardHeader`, `CardTitle`, `CardContent` (page framing)
- a small icon set (per page)
- `SchoolDailyModuleView` (fetches summaries/events and renders KPIs + charts)

### Card names shown on “daily module” pages (via `SchoolDailyModuleView`)

`SchoolDailyModuleView` renders a consistent set of cards/sections. The exact KPI card names are **dynamic**:

- **Phase 5 module score** (header section)
- **KPI grid (4 cards)**:
  - Default: derived from `headlineMetrics` keys (keys are displayed as labels by replacing `_` with spaces)
  - Or: explicit `kpiKeys` passed by the page (if the page overrides KPI labels)
- **Daily trend** (trend card)
- **What happened today** (facts card)

### Logic (TL;DR)

- Daily summaries aggregate “what happened” for a given day/module into a consistent structure used by score engine + copilot.
- The daily module pages are mostly presentation wrappers: they depend on summary/event APIs being populated.

### Key edge cases

- If upstream signals/events are missing for a date, summaries may be empty (UI should handle gracefully).
- Date/timezone boundaries matter; most pipelines assume ISO date inputs and consistent windowing.

### Phase 5: Scores (Ready when DB enabled)

- **Endpoints**
  - `POST /api/school-scores/calculate`
  - `GET/POST /api/school-scores/weight-profiles`
  - `GET /api/school-scores/weight-profiles/active`
  - `GET /api/school-scores/overall` (+ `/trend`, `/compare`)
  - `GET /api/school-scores/modules` and `/modules/[module]` (+ `/trend`, `/drilldown`)
- **DB tables**
  - `school_daily_scores`, `school_daily_score_inputs`, `school_daily_module_scores`
  - `school_score_definitions`, `school_score_weight_profiles`

### Component inventory (Score pages)

- **School Intelligence overview**: `app/(dashboard)/dashboard/school-intelligence/page.tsx`
  - `SIFilterBar`, `SISchoolContextBanner`, `SIQuickLinks`
  - `SIModuleHeader`, `SIKPICard`
  - `SchoolCopilotPanel`, `SchoolCopilotQA`, `SchoolRecommendationsStrip`
  - Hooks: `useSchoolDailyOverview`, `useSchoolOverallScore`
  - **Card names shown (as rendered in UI)**
    - **Overall school score** (hero value card)
    - **Daily facts preview** (facts list card)
    - **GPT Principal Summary** (copilot panel card)
    - **Ask School Intelligence** (Q&A card)
    - **Recommendations** (recommendations card)
    - **Module scores (Phase 5)**: KPI cards labeled:
      - Teacher Productivity
      - Student Occupancy
      - Academic Operations
      - Staff Deployment
      - Space Utilization
      - Discipline
      - Parent Experience
      - Compliance
      - Safety
      - Security
  - **Buttons/links shown (names)**
    - **Refresh**
    - **Bootstrap platform (Phases 1–6 E2E)**
    - Link: **Overall score detail**
    - Link: **Action tasks**
  - **Filters shown (names + options)**
    - Filter bar label: **Filters**
    - **Organization** dropdown options:
      - **All Organizations**
      - **Eurokids Academy (demo school)**
      - (When DB enabled: loaded from `GET /api/organizations`)
    - **Site** dropdown options:
      - **All Sites**
      - **Main Campus**
      - **Annex Building**
      - (When DB enabled: loaded from `GET /api/sites`)
    - **Date range** dropdown options:
      - From `DATE_RANGE_OPTIONS` (`lib/school-intelligence/constants`) — labels vary by config (example: “Last 7 days”)
  - **Banner text shown**
    - **School Intelligence preview**
    - Button/link: **Setup checklist**

- **Overall score detail**: `app/(dashboard)/dashboard/school-intelligence/overall-score/page.tsx`
  - `SIModuleHeader`, `Card*`, `Button`
  - Hooks: `useSchoolDailyModule`, `useSchoolOverallScore`
  - Logic: module visibility via `scoreVisibility.ts`
  - **Card names shown**
    - **Overall School Score** (hero)
    - **Module Breakdown (worst → best)** (grid; each card title is the module label)
    - **Score inputs (Phase 4 daily facts)** (JSON viewer)
  - **Buttons/links shown (names)**
    - Link: **Back to School Intelligence**
    - **Calculate** / **Calculate now** (when empty)
    - Link: **Adjust weights →**

- **Score settings**: `app/(dashboard)/dashboard/school-intelligence/score-settings/page.tsx`
  - `Card*`, `Button`
  - Uses `DEFAULT_WEIGHTS`, `MODULE_LABELS` (weights UI)
  - Persists via `schoolFetch`

### Logic (TL;DR)

- Scores convert daily summary facts into a normalized 0–100 view (overall + module breakdown).
- Weight profiles allow changing how much each module contributes to the overall score.

### Key edge cases

- Weight profiles must be validated (totals, bounds).
- If a module has no data, the score engine must decide whether to treat it as neutral, zero, or excluded (implementation-dependent).

### Phase 6: GPT Copilot (Ready in “demo” mode; live calls require OpenAI)

- **Endpoints**
  - `GET /api/gpt/daily-summary`
  - `POST /api/gpt/daily-summary/regenerate`
  - `POST /api/gpt/ask`
  - `GET /api/gpt/recommendations`
  - `GET /api/gpt/weekly-summary`
- **DB tables (when DB enabled)**
  - `school_gpt_summaries`, `school_gpt_chats`, `school_gpt_recommendations`, `school_gpt_action_tasks`
- **Status**
  - **Ready**: prompt/context builder + guardrails + demo fallback
  - **Not ready**: BI “SQL tool-calling copilot” (planned; not implemented as `/api/gpt/bi-ask`)

### Component inventory (Copilot UI)

Copilot components are primarily used on the School Intelligence overview (and Digest page):

- **Copilot panel**: `components/school-intelligence/SchoolCopilotPanel.tsx`
  - Endpoints: `GET /api/gpt/daily-summary`, `POST /api/gpt/daily-summary/regenerate`
- **Q&A**: `components/school-intelligence/SchoolCopilotQA.tsx`
  - Endpoint: `POST /api/gpt/ask`
- **Recommendations strip**: `components/school-intelligence/SchoolRecommendationsStrip.tsx`
  - Endpoint: `GET /api/gpt/recommendations`

### Buttons/controls shown in Copilot UI (names)

- **GPT Principal Summary**
  - Button: **Regenerate**
  - Button: **Run full pipeline seed (Phases 1–6)** (shown when summary can’t be produced yet)
  - Toggle: **Show data sources (N)** / **Hide data sources (N)**
- **Ask School Intelligence**
  - Suggested question chips (exact text)
    - **Why is teacher productivity low today?**
    - **What happened at gate during dispersal?**
    - **Which rooms were underused?**
    - **Summarize today for the principal.**
  - Input placeholder: **Ask about scores, gates, teachers…**
  - Send icon button: aria-label **Send question**
- **Recommendations**
  - Link: **All actions**
  - Button: **Create action** (becomes **Creating…** then **Action created**)

---

## School Management — per-page UI text inventory (labels, cards, buttons, filters)

This section lists **the exact UI text** (labels users see) per page in School Management, so Codex can reason about UX coverage and gaps.

### `/dashboard/school-management` (Overview)

- **Page title**: **School Management**
- **Subtitle text**: “Foundation setup: campus hierarchy, cameras, timetable, calendar, and duty roster.”
- **Header buttons**
  - Button: **Refresh**
  - Button: **Load demo seed**
- **Progress bar**: `SetupProgressBar` (percent only; no visible label on bar itself)
- **KPI cards (titles)**
  - Cameras mapped
  - Rooms configured
  - Timetable entries
  - Roster entries
  - Calendar days
- **Calendar status card**
  - Card title: **Calendar status**
  - Inline counts: “N working”, “N holidays”, “N exams”, “N events”, “N half days”, “(N days configured)”
- **Next action card**
  - Card title: **Next recommended setup action**
  - Link label is dynamic (example default): **Register cameras →**
- **Missing setup card**
  - Card title: **Missing setup items**
  - Extra line (when present): “Unmapped cameras: …”
- **Ready message**
  - “School is ready for Phase 2 intelligence modules.”
- **Quick links (cards)**
  - Master Data →
  - Cameras and Mapping →
  - Timetable →
  - Staff Duty Roster →
  - School Calendar →
- **Loading state**
  - “Loading setup health…”

### `/dashboard/school-management/master-data` (Master Data)

- **Page title**: **Master Data**
- **Subtitle text**: “Campus hierarchy, rooms, classes, subjects, teachers, and staff — foundation for all intelligence modules.”
- **Header actions**
  - Button: **Bulk import** (via `BulkImportButton` UI)
  - Button: **Seed demo data** (loading: **Seeding…**)
- **Tab bar labels**
  - Sites
  - Buildings
  - Floors
  - Zones
  - Rooms
  - Classes & Sections
  - Subjects
  - Teachers
  - Staff
  - Campus Tree
- **Shared table/selection controls**
  - Search placeholder: “Search…”
  - Button: **Export CSV**
  - Bulk selection bar: “N selected”, **Clear**, **Delete selected (N)** (loading: **Deleting…**)
  - Select-all tooltip/title: “Select all (N)”
  - Empty state: “No records yet.”
  - Empty state hint: “Use the "Seed demo" button above or add entries manually.”
- **Panels and “Add” buttons (exact labels)**
  - Sites: **+ Add Site**
  - Buildings: **+ Add Building**
  - Floors: **+ Add Floor**
  - Zones: **+ Add Zone**
  - Rooms: **+ Add Room**
  - Classes: **+ Add Class**
  - Sections: **+ Add Section**
  - Subjects: **+ Add Subject**
  - Teachers: **+ Add Teacher**
  - Staff Members: **+ Add Staff**
- **Create/Edit sheet common buttons**
  - Button: **Cancel**
  - Button: **Save** / **Saving…**
  - Create labels (footer primary button text):
    - **Create site** / **Save changes**
    - **Create building** / **Save changes**
    - **Create floor** / **Save changes**
    - **Create zone** / **Save changes**
    - **Create room** / **Save changes**
    - **Create class** / **Save changes**
    - **Create section** / **Save changes**
    - **Create subject** / **Save changes**
    - **Create teacher** / **Save changes**
    - **Create staff** / **Save changes**
- **Example field labels/placeholders (visible)**
  - Site: “Site name *” (placeholder “Main Campus”), “Address” (placeholder “123 School Rd…”)
  - Building: “Building name *” (placeholder “Block A”)
  - Floor: “Floor name *” (placeholder “Ground Floor”)
  - Zone: “Zone name *” (placeholder “North Wing”), “Capacity (optional)” (placeholder “—”)
  - Room: “Room code *” (placeholder “R-101”), “Room name *” (placeholder “Room 101”)
  - Subject: “Subject name *” (placeholder “Mathematics”), “Subject code” (placeholder “MATH-01”)
  - Teacher: “Employee code” (placeholder “EMP-001”), “Full name *” (placeholder “Ms. Patel”), “Email” (placeholder “teacher@school.edu”), “Phone” (placeholder “+91 98765 43210”)
  - Staff: “Employee code” (placeholder “STF-001”), “Full name *” (placeholder “Ramesh Kumar”), “Phone” (placeholder “+91 98765 43210”)

### `/dashboard/school-management/cameras` (Cameras and Mapping)

- **Page title**: **Cameras and Mapping**
- **Subtitle text**: “Register cameras, assign purpose, process owner, and location. Classroom/lab cameras require a room.”
- **Header buttons**
  - Button: **Import CSV**
  - Button: **+ Add Camera**
- **Mapping status banner text**
  - “N% mapped”
  - “N total cameras”
  - “N camera(s) missing location or purpose”
  - “N classroom/lab camera(s) missing room assignment”
- **Filters**
  - Search placeholder: “Search cameras…”
  - Purpose dropdown: “All purposes” + purpose values (e.g., Classroom, Gate, Corridor, …, Compliance)
  - Status dropdown: “All statuses” + statuses (Active, Inactive, Offline, Maintenance)
  - Button: **Clear**
- **View toggle**
  - table
  - map
- **Counts + export**
  - “N of N cameras”
  - Button: **Export CSV**
- **Empty state**
  - “No cameras match filters. Load demo seed or add cameras.”
- **Table headers**
  - Code
  - Name
  - Purpose
  - Process Owner
  - Criticality
  - Status
  - Zone
  - Room
  - Active hrs
  - Actions
- **Row actions**
  - Link: **AI detail**
  - Link/button: **Edit**
- **Import sheet**
  - Sheet title: “Import Cameras (CSV)”
  - Dropzone text: “Click to select a CSV file” / “or drag and drop”
  - Validation error: “File must have a header row and at least one data row”
  - Preview text: “N row(s) parsed”, “← Re-upload”
  - Success text: “Import complete.”
  - Buttons: **Close**, **Importing…** / “Import N cameras”
- **Add/Edit camera sheet**
  - Sheet title: **Add Camera** / **Edit Camera**
  - Label: “Camera code *” (placeholder “CAM-001”)
  - Save button: **Add camera** / **Save changes** (loading: **Saving…**)
  - Validation messages (exact text):
    - “Camera code is required”
    - “Purpose is required”
    - “Process owner is required”
    - “Camera must be mapped to a zone or room”
    - “Classroom and lab cameras must have a room assigned”
    - “Active end time must be after start time”

### `/dashboard/school-management/cameras/[id]` (Camera AI Detail)

- **Breadcrumb / page title**
  - Title: “CAMCODE — Name” (or “Camera detail”)
  - Subtitle: “Health timeline, recent signals, and processing configuration.”
- **Top links**
  - “← AI Health grid”
  - “Open signal timeline →”
  - “Camera mapping”
- **Loading/empty**
  - “Loading…”
  - “Camera not found.”
- **Card headings**
  - “Health timeline (recent)”
  - “Processing config (read-only)”
  - “Recent signal batches”
  - “Recent signals”
- **Empty states**
  - “No health events recorded.”
  - “No processing config.”
  - “No batches yet.”
  - Recent signals link: “Full day replay →”
- **Field labels shown**
  - Purpose:
  - Criticality:
  - Process owner:
  - Freshness: Fresh / Stale
  - “Last signal: …”
  - Processing config keys: Sample rate, Min confidence, Snapshots (Enabled/Disabled), Active (Yes/No), Enabled signals

### `/dashboard/school-management/timetable` (Timetable)

- **Page title**: **Timetable**
- **Subtitle text**: “Class schedules mapped to rooms and teachers. Overlap detection included.”
- **Header buttons**
  - Button: **Load sample schedule** (loading: **Loading…**)
  - Button: **Import CSV**
  - Button: **+ Add Entry**
  - Confirmation text: “This replaces all timetable entries with a small sample (Grade 1 A/B, Grade 2 A). Continue?”
- **No-data helper banner**
  - Title line: “No timetable yet”
  - Checklist text includes:
    - “Seed demo data”
    - “Load sample schedule”
    - “Import CSV”
    - Link text: “sample file”
- **Stats bar labels**
  - “N total entries”
  - “N section(s) scheduled”
  - “N teacher(s) assigned”
  - “N room(s) in use”
- **Filters**
  - Label: “Class (grade)” (dropdown default: “All classes”)
  - Label: “Section” (dropdown default: “All sections” / “All sections in class”)
  - Button: **Clear filters**
  - Helper line: “Pick a class and section to see that group’s weekly calendar…”
- **View tabs**
  - Weekly Grid
  - By Section
  - By Teacher
  - By Room
- **Empty states**
  - “Loading timetable…”
  - “No timetable entries. Load demo seed or add entries.”
  - “No entries for selected teacher.”
  - “No entries for selected room.”
  - “No entries for selected section.”
- **Table headers (Teacher view)**
  - Day, Time, Section, Subject, Room, Type
- **Table headers (Room view)**
  - Day, Time, Section, Subject, Teacher, Conflict
  - Conflict badge: “Double-booked”
- **Add entry sheet**
  - Sheet title: “Add Timetable Entry”
  - Field labels: Class, Section *, Day of week *, Period type, Start time *, End time *, Subject, Teacher, Room *
  - Primary button: **Add entry** (loading: **Saving…**)
  - Validation messages:
    - “Section is required”
    - “Room is required”
    - “Times are required”
    - “End time must be after start time”
- **Import timetable sheet**
  - Sheet title: “Import Timetable (CSV)”
  - Primary button (commit step): **Commit N entries** (loading: **Importing…**)

### `/dashboard/school-management/calendar` (School Calendar)

- **Page title**: **School Calendar**
- **Subtitle text**: “Working days, holidays, exams, and special schedules. Upload a .ics or .csv file to import in bulk.”
- **Header buttons**
  - Button: **Upload Calendar**
  - Button: **Bulk Mark**
- **View tabs**
  - Month View
  - Heat Summary
  - List View
- **Month navigation**
  - Buttons: “‹” and “›”
  - Center label: “{MonthName} {Year}”
- **Loading state**
  - “Loading calendar…”
- **List table headers**
  - Date
  - Day type
  - Label
  - Actions
- **List row action**
  - Link/button: **Edit**
- **List empty state**
  - “No calendar entries yet. Use Upload Calendar or click any day to add.”
- **Upload sheet**
  - Sheet title: “Upload Calendar”
  - Success text: “Import complete!” + “N calendar entries saved.”
  - Dropzone text: “Drop your calendar file here” / “or click to browse”
  - File hint: “Click to replace”
  - Format hint title: “How it works”
  - Errors:
    - “Unsupported file type. Please upload an .ics or .csv file.”
    - “No valid events found. Make sure dates are in YYYY-MM-DD or DD/MM/YYYY format.”
    - “Failed to parse file. Please check the format and try again.”
  - Preview controls:
    - “N events detected — classified automatically”
    - Button: “Show fewer”
    - Button: “Show all N events”
    - Placeholder: “Event name”
  - Footer buttons: **Cancel**, **Importing…** / “Import N events”

### `/dashboard/school-management/staff-duty` (Staff Duty Roster)

- **Page title**: **Staff Duty Roster**
- **Subtitle text**: “Gate, floor, corridor, playground, bus bay, lab, and emergency exit coverage. ⚡ marks critical windows.”
- **Header buttons**
  - Button: **Export CSV**
  - Button: **Import CSV**
  - Button: **+ Add Duty**
- **Stats line text** (when data exists)
  - “N total assignments”
  - “⚡ N critical windows”
  - “⚠ N gap(s) in critical coverage”
  - “✓ All critical windows staffed”
- **Gap banner**
  - Title: “⚠ Critical window coverage gaps”
  - Line format: “• {DutyType}: critical window has no staff assigned”
  - Hint: “No critical windows defined yet — mark Gate and Playground duties as critical.”
- **Filters**
  - Day dropdown: “All days”
  - Duty dropdown: “All duty types”
  - Button: **Clear**
- **View toggle**
  - grid
  - list
- **Loading state**
  - “Loading roster…”
- **Empty states**
  - “No roster entries for this day. Load demo seed or add entries.”
  - “No roster entries. Load demo seed or add entries.”
- **Grid view header**
  - “Time slot” + duty types as columns (Gate, Floor, Corridor, Playground, BusBay, Lab, Reception, EmergencyExit)
- **List view headers**
  - Staff, Duty, Day, Time, Zone, Critical
- **Import roster sheet**
  - Sheet title: “Import Duty Roster (CSV)”
  - Hint: “Required columns: staffMemberId, zoneId, dutyType, dayOfWeek, startTime, endTime, isCriticalWindow”
  - “Click to select CSV”
  - Preview: “N row(s) ready to import”, “← Re-upload”
  - Footer buttons: **Close**, **Importing…** / “Import N entries”
  - Success line: “✓ N entries imported.”
- **Add assignment sheet**
  - Sheet title: “Add Duty Assignment”
  - Labels: Staff member *, Zone (optional), Duty type, Day, Start time *, End time *
  - Toggle label: “Critical window (⚡ shown as gap if unstaffed)”
  - Buttons: **Cancel**, **Add assignment** (loading: **Saving…**)
  - Validation messages:
    - “Staff member is required”
    - “Times are required”
    - “End time must be after start”

### `/dashboard/school-management/signals` (Signal Timeline)

- **Page title**: **Signal Timeline**
- **Subtitle text**: “Ingested AI signals across cameras — filter by type, camera, date, and confidence.”
- **Summary cards**
  - Total signals
  - Filtered
  - Signal types
  - Avg confidence
- **Top chips**
  - Signal type chips are dynamic text (top 6 by volume), show type + a count badge.
- **Filters**
  - Camera (dropdown): “All cameras”
  - Signal type (dropdown): “All types”
  - From date (date input)
  - To date (date input)
  - Min confidence: “Min confidence: N%” (range slider)
  - Buttons: **Clear**, **Refresh**
  - Button: “Export CSV (max 10k)”
  - Button: **Seed signals** (loading: **Seeding…**)
- **Info card**
  - “Raw AI evidence only — not management conclusions or GPT summaries. Export is capped at 10,000 rows.”
- **Empty state**
  - “No signals match filters. Try seeding demo data or adjusting filters.”
- **Table headers**
  - Camera
  - Signal type
  - Value
  - Confidence
  - Observed at
  - Metadata
- **Table footer hint**
  - “Showing 200 of N signals. Add filters to narrow results.”

### `/dashboard/school-management/ai-health` (Cameras & AI Health)

- **Page title**: **Cameras & AI Health**
- **Subtitle text**: “Stream health, signal freshness, and worker summary — operational evidence only (no management scores).”
- **Top buttons**
  - **Seed demo signals**
  - **Refresh**
  - **Worker health**
  - **Signal timeline**
- **No camera banner**
  - “No cameras registered. Complete Phase 1 camera mapping first, then seed AI signals.”
- **KPI card labels**
  - “Camera Health Score (daily)”
  - Active cameras
  - Online
  - Critical offline
  - Stale signals
  - Tampered
- **List card**
  - “Cameras reducing today’s health score”
- **Filters**
  - Purpose: dropdown default “All”
  - Criticality: dropdown default “All”
  - Checkbox label: “Stale only”
- **States**
  - “Loading health grid…”
  - “No cameras match filters.”

### `/dashboard/school-management/workers` (AI Workers)

- **Page title**: **AI Workers**
- **Subtitle text**: “Edge worker registry — heartbeat metrics and processing configuration.”
- **Top buttons**
  - “Seed workers + signals” (loading: **Seeding…**)
  - **Refresh**
- **Status cards**
  - Healthy
  - Stale
  - Unhealthy
- **Empty state**
  - “No workers registered. Seed AI signals to register demo workers.”
- **Worker card UI labels**
  - “Heartbeat:” + “Never” (when missing)
  - Toggle text: “▼ Show processing config” / “▲ Hide processing config”
  - Section: “Enabled signals (N)”
  - Keys in config: Camera ID, Sample rate, Min confidence, Snapshot, Active

### `/dashboard/school-management/settings` (Settings)

- **Page title**: **Settings**
- **Subtitle text**: “Organization defaults, compliance checklist, teaching zones, and audit trail.”
- **Cards**
  - Phase 2 readiness
    - Text: “Ready for Phase 2.” / “Complete missing items on overview.”
    - Checkbox label: “Strict Phase 2 gate”
  - Organization defaults
    - Fields: Timezone, Academic year, Timetable overlaps (options: Block, Warn only)
  - Compliance checklist
    - Helper: “Restricted zones (link to risk areas)”
  - Teaching zones — {camera name}
    - Fields: “Board polygon (JSON)”, “Desk polygon (JSON)”
  - Audit log
- **Buttons**
  - **Save settings**
  - **Refresh**

## School Intelligence — per-page UI text inventory (labels, cards, buttons, filters)

This section lists **the exact UI text** (labels users see) per page, so Codex can reason about UX coverage and gaps.

### `/dashboard/school-intelligence/master-data` (Master Data Setup)

- **Page title**: **Master Data Setup**
- **Header/description text**: “Foundation data that gives school context to every AI detection. Complete Phase 1 before enabling intelligence modules.”
- **Cards (KPI labels)**
  - **Cameras mapped** (hint: “Active cameras tagged”)
  - **Rooms with capacity** (hint: “Capacity required”)
  - **Timetable entries** (hint: “Active class periods”)
  - **Calendar days** (hint: “Needs ≥ 30”)
- **Progress text**
  - “**X% complete**”
  - “**Y of Z Phase 1 items complete**”
  - “**Ready for Phase 2 ✓**” / “**Complete Phase 1 first**”
- **Checklist section titles**
  - **Setup checklist**
  - **Intelligence inputs**
  - **Camera purpose mapping**
- **Checklist row status pills**
  - **Done** / **Pending** / **Next**
- **Checklist items (exact labels)**
  - Organization profile
  - Site profile
  - Camera purpose mapping
  - Room capacity
  - School calendar
  - Timetable
  - Staff duty roster
  - Teacher schedule mapping
  - Break / lunch / dispersal timing
  - Risk zone definitions
  - Compliance & safety waivers
- **Buttons/links**
  - Link: **School management**

### `/dashboard/school-intelligence/gate-flow` (Gate Arrival & Dispersal)

- **Page title**: **Gate Arrival & Dispersal**
- **Cards**
  - Dispersal congestion (process_daily)
  - Arrival congestion (process_daily)
  - GateCongestion events (rule engine)
  - Gate & Campus Windows
  - Gate & Congestion Alerts
- **Badges/labels**
  - Window type labels: Arrival, Dispersal, Break, Lunch, Assembly, Maintenance
  - Status badge: **Live**
  - Empty state: “No time windows defined.”
  - Hint: “Add arrival/dispersal windows in School Management → Settings.”
  - Green banner: “No congestion alerts for this date.”

### `/dashboard/school-intelligence/academic-operations` (Academic Operations)

- **Page title**: **Academic Operations**
- **Summary cards**
  - Live
  - Upcoming
  - Late (day) (hint text: “classroom_daily”)
  - Missed (day) (hint text: “classroom_daily”)
- **Period schedule card**
  - Card title: “Period Schedule — Mon/Tue/…”
  - Table headers: Time, Section, Subject, Teacher, Room, Status
  - Status pills: Conducted, Missed, Live, Upcoming, Late start
  - Teacher empty label: **Unassigned**
  - Empty state: “No periods scheduled for Mon/Tue/…”
- **Anomalies card**
  - Card title: **Academic Anomalies**
  - Green banner: “No late or missed signals in classroom_daily; no rule-engine academic events.”
- **Daily module KPI labels (fixed by page)**
  - Conducted %
  - Late periods
  - Missed

### `/dashboard/school-intelligence/zones-schedule` (Zones & Schedule)

- **Page title**: **Zones & Schedule**
- **Buttons/links**
  - Link: **Back to School Intelligence**
  - Button: **Refresh**
  - Link: **Configure timetable →**
  - Link: **Configure rooms →**
  - Link: **Configure zones →**
  - Link: **Edit timetable →**
  - Link: **Manage rooms & zones →**
  - Link: **Space utilization scores →**
- **Day summary bar labels**
  - “X live”, “Y upcoming”, “Z past”, “N total periods”
  - Warning: “No timetable data for this day — seed foundation data first.”
- **View tabs (exact labels)**
  - Schedule
  - Rooms
  - Zones
- **Schedule empty state**
  - “No timetable entries for Monday/Tuesday/…”
- **Rooms view cards**
  - Occupied now
  - Empty
  - Total rooms
  - Empty state: “No rooms configured.”
- **Zones view**
  - Section label: “Risk Zones (N)”
  - Badge: “⚠ Risk”
  - Empty state: “No zones configured.”

### `/dashboard/school-intelligence/discipline` (Discipline Intelligence)

- **Page title**: **Discipline Intelligence**
- **Summary cards**
  - Total incidents
  - Critical
  - Resolved
- **Event list card title**
  - Behaviour Events
- **Severity filter labels**
  - all, critical, high, medium, low
- **Type chip labels (examples)**
  - Running, Loitering, Restricted Zone, Unsafe Climbing, General Discipline, Exit Crowding
- **Empty states**
  - “No discipline incidents for this date.”
  - “No events match the current filter.”
- **Daily module KPI labels (fixed by page)**
  - Running
  - Loitering

### `/dashboard/school-intelligence/compliance` (Compliance Intelligence)

- **Page title**: **Compliance Intelligence**
- **Summary cards**
  - Total violations
  - Critical
  - Open
- **Checklist card title**
  - Compliance Checklist
- **Events card title**
  - Violation Events
- **Empty state**
  - “Full compliance — no violations detected for this date.”
- **Daily module KPI labels (fixed by page)**
  - Violations

### `/dashboard/school-intelligence/campus-safety` (Campus Safety & Security)

- **Page title**: **Campus Safety & Security**
- **Buttons/links**
  - Link: **Back to School Intelligence**
  - Button: **Refresh**
- **Score gauge cards**
  - Safety Score
  - Security Score
- **Camera health card**
  - Camera Health
  - Status tiles: Online, Offline/Tampered, Total
  - Empty state: “No camera health data. Seed AI signals to populate.”
  - Section label: “⚠ Offline / Tampered Cameras”
- **Alert summary cards**
  - Open events
  - Critical incidents
  - High severity

### `/dashboard/school-intelligence/actions` (GPT Action Tasks)

- **Page title**: **GPT Action Tasks**
- **Buttons/links**
  - Link: **Back to School Intelligence**
  - Button: **Refresh**
  - Link (empty state): **Go to digest & recommendations →**
  - Per-task button: **Mark complete** (becomes **Completing…**)
- **Summary cards**
  - Open tasks
  - Completed
  - Total
- **Status tabs**
  - all
  - open
  - completed
- **Empty state text**
  - “No open tasks. Create from recommendations on the Overview or Digest page.”

### `/dashboard/school-intelligence/parent-experience` (Parent Experience)

- **Page title**: **Parent Experience**
- **Cards**
  - Arrival Windows
  - Dispersal Windows
  - Congestion & Experience Events
- **Headline banner states**
  - Clear / Moderate / High / Critical
  - “Overall gate experience — YYYY-MM-DD”
  - “No congestion events — smooth parent experience for this date.”
- **Daily module KPI labels (fixed by page)**
  - Dispersal congestion (min)

### `/dashboard/school-intelligence/staff-deployment` (Staff Deployment)

- **Page title**: **Staff Deployment**
- **Summary cards**
  - Active shifts
  - Critical windows
  - Missing alerts
- **Roster card**
  - Duty Roster — Sun/Mon/…
  - Table headers: Staff member, Role, Duty type, Zone, Time, Status, Critical
  - Status pills: Active / Done / Upcoming
  - Critical pill: Critical
  - Empty state: “No duty shifts for Mon/Tue/…”
- **Role filter chips**: role names + `all`
- **Alerts card**
  - Deployment Alerts
  - Green banner: “All posts covered — no missing-staff alerts for this date.”
- **Daily module KPI labels (fixed by page)**
  - Coverage %

### `/dashboard/school-intelligence/space-utilization` (Space Utilization)

- **Page title**: **Space Utilization**
- **Summary cards**
  - Occupied now
  - Avg utilization
  - Unused today
- **Room Utilization card**
  - Room Utilization
  - Room-type filter chips: `all` + room types (Classroom/Lab/Library/…)
  - Room status badges: Occupied / Scheduled / Unused
  - Empty state: “No rooms found. Seed demo data from Master Data.”
- **Green banner**: “No space-utilization anomalies for this date.”
- **Daily module KPI labels (fixed by page)**
  - Utilization %

### `/dashboard/school-intelligence/student-occupancy` (Student Occupancy Intelligence)

- **Page title**: **Student Occupancy Intelligence**
- **Summary cards**
  - Occupied rooms
  - Over capacity
  - Under-used
- **Room Occupancy Grid card**
  - Room Occupancy Grid
  - Status badges: Overcrowded / On track / Under-used / Empty
  - “No class scheduled”
  - Empty state: “No rooms found. Seed demo data from Master Data.”
- **Events card**
  - Occupancy Events
- **Green banner**: “No occupancy anomalies for this date.”
- **Daily module KPI labels (fixed by page)**
  - Expected match %
  - Overcrowding
  - Under-use

### `/dashboard/school-intelligence/teacher-productivity` (Teacher Productivity Intelligence)

- **Page title**: **Teacher Productivity Intelligence**
- **Schedule card**
  - Schedule — Sun/Mon/…
  - Status pills: Live / Done / Upcoming
  - “No teacher”
  - Empty state: “No timetable entries for Mon/Tue/…”
- **Gaps card**
  - Supervision Gaps
  - Empty state: “No supervision gaps detected for this date.”
- **Daily module KPI labels (fixed by page)**
  - Class conducted %
  - Teacher presence %
  - On-time start %
  - Supervision gaps

### `/dashboard/school-intelligence/teacher-supervision` (Teacher Presence & Supervision)

- **Page title**: **Teacher Presence & Supervision**
- **Teacher Assignment Summary card**
  - Teacher Assignment Summary
  - Table headers: Teacher, Periods, Sections, Gaps, Status
  - Status text: “✓ Clear” / “⚠ Gaps”
  - Warning line: “N periods with no teacher assigned today.”
- **Gap Events card**
  - Gap Events
  - Empty state: “No supervision gaps for this date.”
- **Daily module KPI labels (fixed by page)**
  - Supervision gaps
  - Presence %
  - Classes conducted %

### `/dashboard/school-intelligence/digest` (Daily Principal Digest)

- **Page title**: **Daily Principal Digest**
- **Date navigation controls**
  - Buttons: Chevron Left / Chevron Right (icon-only)
  - Button: Today
- **Pipeline hint card**
  - Text: “The digest pipeline requires: seeded foundation data → AI signals → rule evaluation → daily summaries → score engine → GPT generation.”
- **Section headings**
  - Principal Summary
  - Ask School Intelligence
  - Recommendations
  - Pipeline setup
- **Pipeline setup ordered list (exact text)**
  1. School Management → Master Data → Seed demo
  2. School Management → Signals → Seed signals
  3. Intelligence → Rules → Seed default rules
  4. Intelligence → Events → Evaluate rules
  5. Then regenerate this digest

### Logic (TL;DR)

- Copilot builds a structured “context JSON” (summaries, scores, events) and asks the model to answer **only using that context**.
- If `OPENAI_API_KEY` is not set, endpoints fall back to a **demo response** (for UI usability).

### Key edge cases

- Context size must be truncated safely (guardrails) to avoid token overrun and high costs.
- Responses should be grounded; unknown claims should be avoided or marked as unknown.

---

### `/dashboard/school-intelligence/events` (Events Inbox)

- **Page title**: **Intelligence Events**
- **Subtitle text**: “Rule engine output — actionable events for supervisors and principals.”
- **Top action buttons**
  - **Seed rules + signals** (loading: **Seeding…**)
  - **Evaluate rules** (loading: **Evaluating…**)
  - **Refresh**
- **Summary cards**
  - Open
  - Critical
  - Acknowledged
  - Resolved
- **Status filter chips**
  - All
  - Open
  - Acknowledged
  - Assigned
  - Resolved
- **Filter panel labels**
  - From (date input)
  - To (date input)
  - Event type (dropdown)
    - All types
    - TeacherSupervisionGap
    - GateCongestion
    - DispersalDelay
    - CriticalCameraOffline
    - RunningDetected
    - FallDetected
  - Severity (dropdown): All severities, Low, Medium, High, Critical
  - Module (dropdown): All modules (options are derived from data)
  - Zone (dropdown): All zones (options derived from master data)
  - Site (dropdown): All sites (options derived from master data)
- **Bulk selection strip** (only when there are selected rows)
  - “N selected”
  - Button: **Bulk acknowledge (open only)** (loading: **Acking…**)
  - Button: **Select all open in view**
  - Button: **Clear**
- **Empty/healthy day states**
  - “Healthy day — no intelligence events for today.”
  - “Widen the date range or seed demo data to see sample events.”
  - “No events yet. Seed rules + signals, then evaluate.”
  - “No events match the current filters.”
- **Events table headers**
  - Time
  - Type
  - Severity
  - Location
  - Status
  - Assignee
  - Actions
- **Row actions**
  - Button: **Ack** (shown for Open)
  - Button: **Resolve**
  - “Chevron” icon button (opens detail)

### `/dashboard/school-intelligence/events/[id]` (Event detail)

- **Page shell title**: event type text (dynamic, e.g. `GateCongestion`)
- **Loading state**
  - Page title: **Event detail**
  - Description: “Loading event…”
  - Breadcrumb current: “Loading…”
  - Body line: “Fetching event…”
- **Breadcrumb/actions**
  - Parent crumb: **Events**
  - Current crumb: “Event #N”
  - Top-right link: **Events inbox**
- **Hero badges**
  - Severity badge: Low / Medium / High / Critical
  - Status badge: Open / Acknowledged / Assigned / Resolved
  - Confidence chip: “NN% confidence”
- **Hero detail rows**
  - Started:
  - Ended: (only if present)
  - Camera: “#N” (only if present)
  - Zone: “#N” (only if present)
  - Room: “#N” (only if present)
  - Assigned: (assignee name if present)
- **Location & context panel**
  - Section title: **Location & context**
  - Empty state: “No enriched context for this event (IDs or master data missing).”
  - Context row keys (shown only when value exists): Rule, Room, Zone, Class, Section, Subject, Period, Time window, Calendar day, Process owner, Duty roster, Camera purpose
- **Evidence metrics panel** (only when `metrics` exists)
  - Section title: **Evidence metrics**
  - “Signal IDs: …” (only when signalIds exist)
- **Phase 2 evidence panel**
  - Section title: **Phase 2 evidence**
  - Description: “Inspect raw signals for this camera in the Signal Timeline.”
  - Link: **Open Signal Timeline**
- **Take action panel** (hidden when status is Resolved)
  - Section title: **Take action**
  - Input placeholder: “Optional note…”
  - Buttons:
    - **Acknowledge** (only when Open; loading spinner)
    - **Assign** (when Open or Acknowledged; loading spinner)
    - **Resolve** (always available until Resolved; loading spinner)
- **Activity timeline panel** (only when acknowledgements exist)
  - Section title: **Activity timeline**
  - Item labels: Acknowledged / Assigned / Resolved

### `/dashboard/school-intelligence/rules` (Intelligence Rules)

- **Page title**: **Intelligence Rules**
- **Subtitle text**: “Rule catalog — enable/disable rules and review detection thresholds.”
- **Top action buttons**
  - **Seed default rules** (loading: **Seeding…**)
  - **Refresh**
- **Stats cards** (only when rules exist)
  - Total rules
  - Enabled
  - Disabled
  - Modules
- **Module filter chips**
  - **All modules**
  - One chip per module (label is module name + a numeric count badge)
- **Filters bar**
  - Search input placeholder: “Search rules…”
  - Severity dropdown:
    - All severities
    - Low / Medium / High / Critical
  - Enabled segmented filter:
    - all
    - enabled
    - disabled
- **Rules empty states**
  - “No rules configured. Seed default rules to get started.”
  - “No rules match the current filters.”
- **Rules table headers**
  - Rule
  - Module
  - Severity
  - Last fired
  - Cooldown
  - Actions
  - Enabled
- **Row actions**
  - Link: **Edit**
  - Enabled toggle label: **On** / **Off**
  - Toggle tooltip: “Click to disable” / “Click to enable”
  - Disable confirm text (specific rule): “Disable Critical Camera Offline? This may hide compliance outages until re-enabled.”

### `/dashboard/school-intelligence/score-settings` (Rules & Score Settings)

- **Page title**: **Rules & Score Settings**
- **Help text**: “Weight profiles are versioned — saving creates a new profile without rewriting historical scores.”
- **MVP3 hint text** (conditional): “MVP3 mode: overall uses Teacher, Occupancy, Academic, and Parent only.”
- **Read-only banner** (when demo role is `site_viewer`)
  - “Read-only for site viewers. Switch demo role to org_admin in localStorage key school-demo-role.”
- **Demo role selector**
  - Label: “Demo role (localStorage)”
  - Options: org_admin, site_viewer
- **Overall weight profile card**
  - Card title: “Overall weight profile”
  - Slider labels: module labels from `MODULE_LABELS` (e.g. Teacher Productivity, Student Occupancy, etc.)
  - Total line: “Total: N% (target 100%)”
  - Preview line: “Preview overall (today): N”
  - Checkbox: “Apply immediately (otherwise effective next calendar day)”
  - Primary button: “Save profile & recalculate” (disabled unless Total is 100%)
  - Confirm modal text (when apply immediately): “Apply new weights immediately for today? Historical scores for past dates stay unchanged.”
- **Version history card**
  - Card title: “Version history”
  - Empty row: “Default docx weights only.”
- **Link**
  - “Edit intelligence rules →”

### Redirect-only pages

- **`/dashboard/school-intelligence/occupancy`** redirects to **`/dashboard/school-intelligence/student-occupancy`**.
- **`/dashboard/school-intelligence/incidents`** redirects to **`/dashboard/school-intelligence/discipline`**.

## Aggregator Simulator (Edge BI) — every 5 minutes

This is the edge-side pipeline that creates BI-friendly summaries and syncs them to Postgres.

### What it does

- **Every 5 minutes (UTC-aligned to :00, :05, :10, …)**: aggregates the **previous completed** window.
- **Every minute**: attempts to sync pending summaries (retry loop).

### Where it runs

- Scheduler: `vision/electron/bi/biScheduler.ts`
- Aggregation logic: `vision/electron/bi/biZoneAggregator.ts`
- Sync client: `vision/electron/bi/biSyncClient.ts`
- Started on boot: `vision/electron/main.ts` (`biScheduler.start(initialConfig)`)

### Data flow

- **Input (edge/local DB)**: `ai_detection`
- **Local summary table (edge/local DB)**: `bi_zone_activity_5m`
- **Sync endpoint (server)**: `POST /v1/bi/zone-activity/bulk` (headers `X-API-Key`, `X-Site-Id`)
- **Cloud/Postgres table (server DB)**: `cloud_zone_activity_summary`
  - Server implementation: `vision/server/src/routes/biZoneActivity.ts`
  - Idempotent upsert key: `(site_id, camera_id, COALESCE(zone_id,''), window_start)`

### What is “synced” to Postgres

Each 5‑minute summary row contains:

- window start/end + duration
- counts (person avg/max, vehicle/equipment)
- motion/activity score + low-activity flag
- detection_count + source_frame_count
- metadata JSON (`class_breakdown`, etc.)

### Logic (TL;DR)

- The edge aggregator groups detections into 5‑minute UTC windows and produces one summary row per camera (zone_id is `NULL` in v1).
- The sync client uploads unsynced rows in batches and marks them as synced only after successful upload.
- Cloud upsert is **idempotent** on the unique window key (safe to retry).

### Key edge cases

- Late-arriving detections are mitigated by aggregating the **previous completed** window.
- If the server is down, rows remain pending and are retried on the next tick (no data loss, but delayed availability).

---

## Setup (dev)

```bash
cd D:\business_intelligence\dashboard
npm install
npm run dev
```

---

## Environment variables (summary)

See `.env.example`. Common:

- **`NEXT_PUBLIC_USE_MOCK_DATA=true`**: run UI without backend/DB
- **`DATABASE_URL` + `SCHOOL_INTELLIGENCE_DB=1`**: enable DB-backed School modules (use a separate DB later)
- **`OPENAI_API_KEY`**: enable live GPT copilot calls
