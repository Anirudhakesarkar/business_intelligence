# School Intelligence Subpages Standard UI Brief

Use this brief in Cursor to update the School Intelligence subpages so they follow the current standard UI used by:

`http://localhost:3002/dashboard/school-intelligence/campus-safety`

Reference implementation:

`app/(dashboard)/dashboard/school-intelligence/campus-safety/page.tsx`

The goal is to make only the target School Intelligence module pages listed in this brief feel consistent with Campus Safety, with the same professional dark dashboard style and the same dynamic content model.

## What I Checked

The Campus Safety page is the current standard. It uses a modern operational dashboard layout with:

- Breadcrumb
- Shared School Intelligence filter bar
- Dynamic observation trend chart
- Dynamic metric summary cards
- Dynamic observation types grid
- Dynamic observation table/feed
- Dynamic score panel

The key dynamic sections are:

- `Observation trend`
- `Observation types`
- `Safety observations` table/feed
- `Overall score`

These same patterns should be applied only to the target pages listed below.

## Project Context

This is a Next.js 14 App Router project using:

- TypeScript
- Tailwind CSS
- `lucide-react`
- Shared UI primitives in `components/ui`
- School Intelligence components in `components/school-intelligence`
- School Intelligence routes under `app/(dashboard)/dashboard/school-intelligence`

Important existing components/files:

- `components/school-intelligence/SIFilterBar.tsx`
- `components/school-intelligence/SchoolIntelligenceBreadcrumbs.tsx`
- `components/school-intelligence/SISection.tsx`
- `components/school-intelligence/SIPageShell.tsx`
- `components/school-intelligence/SIModuleScoreCard.tsx`
- `components/school-intelligence/campus-safety/SafetyEventFeed.tsx`
- `components/school-intelligence/campus-safety/CampusSafetyScorePanel.tsx`
- `lib/school-intelligence/date-range.ts`
- `lib/school-intelligence/module-routes.ts`
- `lib/school-intelligence/module-score-insights.ts`
- `lib/school-intelligence/types.ts`

## Main Requirement

Update only the 4 target School Intelligence module subpages listed in this brief to use the Campus Safety standard UI structure.

The page should not be only static UI. The following parts must be dynamic and connected to page state/data:

1. Observation trend
2. Observation types
3. Observation table/feed
4. Score panel

All sections must respond to:

- Organization filter
- Site filter
- Date range filter
- Custom date range when selected
- Refresh action when available

## Cleanup Requirement

When replacing old subpage designs with the Campus Safety standard, remove anything that is no longer used.

This cleanup applies to:

- UI components, cards, tabs, tables, charts, copy, mock blocks, local constants, and unused imports
- Frontend helper functions, old local state, unused hooks, and duplicated mapping logic
- Backend routes, API helpers, services, seed helpers, or library functions that exist only for removed UI sections
- Database artifacts such as unused demo seed data, obsolete migration helpers, unused tables, unused columns, or unused views when they are exclusively tied to removed content

Do not leave unused content hidden with CSS, commented out, or disconnected from navigation. If a feature, panel, endpoint, helper, or DB artifact is not used by the final standard UI and is not used elsewhere in the project, remove it completely.

Before removing backend or database code, verify it is not referenced by other pages, tests, scheduled jobs, migrations, or shared APIs. Keep shared backend/database functionality when it still supports another active page.

## Target Pages To Update

Apply this standard only to these School Intelligence module pages:

- `app/(dashboard)/dashboard/school-intelligence/teacher-productivity/page.tsx`
- `app/(dashboard)/dashboard/school-intelligence/space-utilization/page.tsx`
- `app/(dashboard)/dashboard/school-intelligence/parent-experience/page.tsx`
- `app/(dashboard)/dashboard/school-intelligence/compliance/page.tsx`

Target URLs:

- `http://localhost:3002/dashboard/school-intelligence/teacher-productivity`
- `http://localhost:3002/dashboard/school-intelligence/space-utilization`
- `http://localhost:3002/dashboard/school-intelligence/parent-experience`
- `http://localhost:3002/dashboard/school-intelligence/compliance`

Keep `campus-safety` as the visual and behavior reference only. Do not redesign `campus-safety`; only make shared-component changes there if they are necessary and the page remains visually unchanged.

Do not include any School Intelligence page outside the 4 target pages above unless explicitly requested. Out-of-scope examples:

- `campus-safety` redesign work
- `overview`
- `vision-copilot`
- `events`
- `zones-schedule`
- `rules`
- `score-settings`
- event detail pages

## Standard Page Layout

Every target module subpage should follow this order:

1. Breadcrumb
2. `SIFilterBar`
3. Observation trend card
4. Four compact metric cards
5. Observation types card
6. Two-column lower grid:
   - Left: observation table/feed
   - Right: module score panel

Desktop:

- Trend card full width
- Summary cards in 4 columns
- Observation types full width
- Observation feed and score panel in `lg:grid-cols-2`

Mobile:

- Everything stacks vertically
- Summary cards use 2 columns or 1 column where needed
- Observation type cards do not overflow
- Feed rows wrap cleanly
- Score card remains readable

## Visual Standard

Match the Campus Safety page:

- Background: existing dashboard dark/slate background
- Main cards: `border-slate-800 bg-slate-900/60`
- Inner panels: `bg-slate-950/30` or `bg-slate-950/40`
- Rounded corners: `rounded-lg`, `rounded-xl`, or existing card radius
- Accent: `sky` for neutral data/active controls
- Severity colors:
  - Critical: red
  - High: orange
  - Medium/Watch: amber
  - Low/Info: sky or slate
  - Healthy/Resolved: emerald
- Use lucide icons, not emoji icons
- Keep text compact and operational
- Avoid hero sections, marketing copy, large decorative gradients, and visual clutter

## Dynamic Data Standard

Each module page should load its own dynamic observations/events using the active filter state.

Use the date helpers already used by Campus Safety:

- `resolveSIFilterDates(filters)`
- `resolveSIFilterInstantBounds(filters)`
- `formatSIFilterPeriodLabel(filters)`
- `isInstantInSIFilterPeriod(startedAt, filters)`
- `periodLengthDays(from, to)`
- `scoreCompareLabel(...)`

Use `SIFilters` from:

`lib/school-intelligence/types.ts`

Base filter state:

```ts
const [filters, setFilters] = useState<SIFilters>({
  organizationId: '',
  siteId: '',
  dateRange: '7d',
});
```

Do not hard-code counts. Counts should come from filtered events, daily summaries, or fallback demo data only when live data is empty.

## Recommended Shared Components

To avoid duplicating the Campus Safety logic across 10 pages, create shared module components.

Suggested folder:

`components/school-intelligence/module-standard`

Suggested components:

- `SIObservationTrendCard.tsx`
- `SIObservationMetricCards.tsx`
- `SIObservationTypesGrid.tsx`
- `SIObservationFeed.tsx`
- `SIModuleScorePanel.tsx`
- `SIStandardModulePage.tsx`

The Campus Safety page can keep its custom names or can be migrated to these shared components after the shared components match the current UI.

## Suggested Generic Types

Create shared types for standardized observations:

```ts
export type SIObservationSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export type SIObservationStatus =
  | 'Open'
  | 'Observed'
  | 'Acknowledged'
  | 'Assigned'
  | 'Resolved';

export type SIObservation = {
  id: string | number;
  type: string;
  label: string;
  severity: SIObservationSeverity;
  status: SIObservationStatus;
  startedAt: string;
  summary: string;
  cameraId?: number | string;
  location?: string;
  owner?: string;
  metadata?: Record<string, string | number | null>;
};

export type SIObservationTypeConfig = {
  type: string;
  label: string;
  severity: SIObservationSeverity;
  icon: React.ReactNode;
};

export type SIStandardModuleConfig = {
  title: string;
  scoreModuleKey: string;
  observationsTitle: string;
  observationTypes: SIObservationTypeConfig[];
};
```

Use module-specific configs so each page can map its real event types to the common UI.

## Observation Trend

The observation trend must behave like the Campus Safety chart.

Requirements:

- Full-width card after filters
- Title format: `Observation trend`
- Subtitle: active period label, for example `May 22 - May 29`
- Shows total observation count
- Shows number of buckets in active range
- Buckets should adapt to date range:
  - `24h`: group into time slots
  - `7d` and short custom ranges: group by day
  - long custom ranges: group by month
- Bars should use sky gradient
- Bars should show count labels only when count is greater than zero
- Empty buckets should still render as a thin baseline
- Use accessible `title` text on bars

Implementation hint:

The Campus Safety page already has these helper patterns:

- `buildIncidentBuckets`
- `countEventsInBucket`
- `buildIncidentChartData`
- `SafetyIncidentBarChart`

Move the generic parts into a shared `SIObservationTrendCard` instead of copying logic into every page.

## Metric Summary Cards

Directly below the trend chart, show four compact cards.

Campus Safety uses:

- Observations
- Critical observations
- High priority
- High severity

For each subpage, use the same structure but module-specific labels where useful.

Examples:

- Teacher Productivity:
  - Observations
  - Missed/Late periods
  - High priority
  - Active teachers
- Space Utilization:
  - Observations
  - Unused rooms
  - Overused rooms
  - Avg utilization
- Parent Experience:
  - Observations
  - Congestion events
  - Wait issues
  - High priority
- Compliance:
  - Observations
  - Critical observations
  - Open violations
  - Resolved/clear checks

Cards should be dynamic and recomputed from the filtered observations.

## Observation Types

Every module page needs an `Observation types` card like Campus Safety.

Requirements:

- Grid layout: `grid-cols-2`, `sm:grid-cols-3`
- Each type card includes:
  - lucide icon
  - readable type label
  - short supporting subline (`description`) explaining what the detection covers
  - count badge if count > 0
  - dash if no observations
- Type cards should be severity tinted when count > 0
- Empty type cards should be subdued slate
- No emoji icons
- Use human-readable labels, not raw event type names when possible

Examples:

Teacher Productivity types:

- TeacherMissing
- TeacherLate
- ClassUnattended
- PeriodSkipped
- TeacherSupervisionGap

Compliance types:

- FireExitObstruction
- RestrictedZoneEntry
- Compliance
- ServerRoomEntry
- EmergencyExitCrowding

Use the event types already present in each page where possible, but normalize the labels.

## Observation Table / Feed

Every module page needs a feed/table equivalent to `Safety observations`.

Use the Campus Safety feed style:

- Card title with icon
- Count subtitle: `{count} in view - {priorityCount} high priority - {periodLabel}`
- Segmented tabs:
  - `Priority`
  - `All`
- Scrollable list with max height
- Each row includes:
  - Time
  - Date
  - Icon tile
  - Observation label
  - Severity badge
  - Status badge
  - Summary text
  - Optional metadata such as camera, room, teacher, zone, duty post, or section

Priority tab:

- Show `Critical` and `High`

All tab:

- Show every filtered observation

Empty state:

- Use a clear empty card
- Do not show raw API errors as the main UI
- Message should be module specific but short

Loading state:

- Use `Loader2`
- Match existing Campus Safety loading text style

## Score Panel

Every module page needs a score panel matching the Campus Safety `Overall score` card.

Requirements:

- Right side of lower grid on desktop
- Uses `scoreDisplayStyle(score)`
- Shows:
  - Status badge: `Strong`, `Good`, `Watch`, `At risk`, or `No score`
  - Current score
  - `/ 100`
  - Previous score if available
  - Delta icon if available
  - Progress bar
  - Score insights
- Score insights should be dynamic from module data when possible
- Fallback insights are allowed if there is no live data

Important:

- For Campus Safety, the score panel is `Overall score` and includes safety module context.
- For other module pages, use module-specific titles:
  - `Teacher productivity score`
  - `Occupancy score`
  - `Space utilization score`
  - `Parent experience score`
  - `Compliance score`

Use existing hooks where possible:

- `useSchoolModuleScore`
- `useSchoolOverallScore`
- `useSchoolScoreCompare`

Prefer module score over overall score on subpages. Overall score belongs on overview or Campus Safety only unless the business logic requires otherwise.

## Dynamic Source Mapping

Use existing APIs and data sources already used by the pages.

Common sources:

- `/api/intelligence-events`
- `/api/school-daily-summaries/...`
- `/api/daily-summaries/...`
- module-specific APIs already used in each page

Observation loading pattern:

```ts
const { from, to } = resolveSIFilterInstantBounds(filters);
const q = new URLSearchParams({
  organizationId: String(orgId),
  from,
  to,
});
const res = await fetch(`/api/intelligence-events?${q}`);
```

Then:

- Filter by module event types
- Filter by selected site if supported by event/site fields
- Filter again with `isInstantInSIFilterPeriod`
- Sort newest first
- Fall back to demo observations only when no live data is available

## Module Event Type Guidance

Use and refine these event type sets. If the current code uses better names, keep the current names and map them into readable labels.

Teacher Productivity:

- `TeacherSupervisionGap`
- `TeacherLate`
- `TeacherMissing`
- `ClassUnattended`
- `PeriodSkipped`

Space Utilization:

- `SpaceUtilization`
- `RoomUnderused`
- `RoomOverused`
- `EmptyRoom`
- `LabUnused`

Parent Experience:

- `GateCongestion`
- `ParentExperience`
- `ParentWaitTime`
- `PickupDelay`
- `ArrivalDelay`
- `DispersalCongestion`
- `VehicleStudentOverlap`

Compliance:

- `FireExitObstruction`
- `RestrictedZoneEntry`
- `Compliance`
- `ServerRoomEntry`
- `EmergencyExitCrowding`

## Suggested Refactor Path

Step 1: Extract generic pieces from Campus Safety

- Move chart bucket logic into `SIObservationTrendCard`
- Move feed row design into `SIObservationFeed`
- Move type grid into `SIObservationTypesGrid`
- Move reusable score layout into `SIModuleScorePanel`

Step 2: Keep Campus Safety visually unchanged

- Leave Campus Safety as the reference page by default.
- Only touch Campus Safety if shared component extraction makes it necessary.
- If Campus Safety is touched, confirm it still looks the same at `/dashboard/school-intelligence/campus-safety`.

Step 3: Create module configs

Add a config file such as:

`lib/school-intelligence/module-standard-config.ts`

Each module config should define:

- Route key
- Page title
- Score module key
- Observation title
- Event types
- Type labels
- Icons
- Metric cards
- Insight builder

Step 4: Convert subpages one by one

Start with the simplest:

1. `compliance`
2. `space-utilization`
3. `parent-experience`
4. `teacher-productivity`

Step 5: Verify responsive design and TypeScript

Run build after each group of pages.

## Page-Specific Notes

### Teacher Productivity

Current page has timetable, teacher, subject, room, section, and supervision gap data. Preserve that data but present it using the standard sections:

- Trend: teacher-related observations over time
- Types: teacher missing, late, unattended, gap
- Feed: teacher/period observations
- Score: teacher productivity score

### Space Utilization

Current page has room utilization and timetable data. Convert unused/overused/occupied state into observations and type counts.

### Parent Experience

Current page has arrival/dispersal windows, gate congestion, and parent wait states. Convert parent wait/congestion and gate-flow signals into observations.

### Compliance

Current page already has compliance event types and checklist logic, but it uses a different style and emoji icons. Replace with the standard observation trend, type grid, feed, and score panel.

## Copy Standard

Use short operational copy.

Good:

- `Observation trend`
- `Observation types`
- `6 in view - 6 high priority - May 22 - May 29`
- `Based on observed patterns - for awareness, not alert closure.`

Avoid:

- Long explanations
- Marketing text
- Raw internal API names in visible labels
- Emoji labels

## Acceptance Criteria

The implementation is complete when:

- Each listed subpage visually matches the Campus Safety standard.
- Each listed subpage has a dynamic observation trend.
- Each listed subpage has dynamic observation type counts.
- Each listed subpage has a dynamic observation table/feed.
- Each listed subpage has a dynamic module score panel.
- Filters update all four dynamic sections.
- Refresh updates all dynamic sections where the page has a refresh hook.
- Empty, loading, and error states are polished.
- No text overlaps or clips on mobile.
- No new backend or database work is required.
- Unused old UI, backend helpers/routes, and DB artifacts tied only to removed content are deleted.
- `npm run build` passes.

## Verification

Run:

```bash
npm run build
npm run dev
```

Reference page to compare against, but do not redesign:

```text
http://localhost:3002/dashboard/school-intelligence/campus-safety
```

Open and check only these target pages:

```text
http://localhost:3002/dashboard/school-intelligence/teacher-productivity
http://localhost:3002/dashboard/school-intelligence/space-utilization
http://localhost:3002/dashboard/school-intelligence/parent-experience
http://localhost:3002/dashboard/school-intelligence/compliance
```

For each page, verify:

- Last 24 Hours
- Last 7 Days
- Last 30 Days
- Custom range
- Mobile width around 390px
- Desktop width around 1280px

## Important Implementation Notes

- Keep the Campus Safety page as the source of truth for UI quality.
- Reuse `SIFilterBar`; do not create a different filter design.
- Use `Card` and School Intelligence shared components where possible.
- Convert repeated local page code into shared components.
- Use `lucide-react` icons instead of emoji.
- Keep fallback demo data clearly separated from live data.
- Do not add backend, database, or authentication changes for this UI pass.
- Do not remove existing data fetching unless the replacement keeps the same dynamic behavior.
- Remove dead code completely after migration. This includes unused UI, unused API/backend code, and unused DB artifacts that are not referenced anywhere else.
