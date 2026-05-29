# Vision Copilot UI Brief

Use this brief in Cursor to build a modern, professional, UI-only Vision Copilot page inside the existing Business Intelligence dashboard.

## Project Context

This repository is a Next.js 14 app using:

- App Router with dashboard pages under `app/(dashboard)/dashboard/...`
- TypeScript
- Tailwind CSS
- `lucide-react` icons
- Existing shared UI primitives in `components/ui`
- Existing Business Intelligence components in `components/business-intelligence`
- Existing dashboard navigation in `components/layout/sidebar.tsx`

The current Business Intelligence Copilot page is:

`app/(dashboard)/dashboard/business-intelligence/copilot/page.tsx`

It currently shows a basic AI Copilot chat, filters, suggested questions, and a simple processing flow. Redesign this existing page into a richer **Vision Copilot** UI. This task is UI-only.

## Goal

Create a polished Vision Copilot experience for a video intelligence / business intelligence product. The page should help a manager or operations user ask questions about camera activity, site risk, incidents, people flow, camera health, and evidence snapshots.

The page should feel like a real production dashboard, not a landing page. It should be dense enough for daily operations, easy to scan, and professional.

## Scope

Build UI only.

Do:

- Redesign the existing `/dashboard/business-intelligence/copilot` page.
- Rename the visible page title from `AI Copilot` to `Vision Copilot`.
- Update the sidebar label from `AI Copilot` to `Vision Copilot`.
- Use mock/static data inside the UI.
- Keep any current API calls optional or disabled for now.
- Use existing UI primitives where possible: `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Button`, `Badge`.
- Use `lucide-react` icons.
- Keep all new code TypeScript-safe.
- Make the page responsive for desktop, tablet, and mobile.

Do not:

- Build backend APIs.
- Change database schema.
- Add authentication changes.
- Add real camera streaming.
- Add OpenAI/GPT integration.
- Add new heavy UI libraries unless absolutely necessary.

## Recommended Files

Edit:

- `app/(dashboard)/dashboard/business-intelligence/copilot/page.tsx`
- `components/layout/sidebar.tsx`

Create if useful:

- `components/business-intelligence/vision-copilot/VisionCopilotHeader.tsx`
- `components/business-intelligence/vision-copilot/VisionMetricStrip.tsx`
- `components/business-intelligence/vision-copilot/VisionScenePanel.tsx`
- `components/business-intelligence/vision-copilot/VisionCameraGrid.tsx`
- `components/business-intelligence/vision-copilot/VisionCopilotChat.tsx`
- `components/business-intelligence/vision-copilot/VisionEvidenceTimeline.tsx`
- `components/business-intelligence/vision-copilot/VisionActionQueue.tsx`

Keep components small and readable. If the page is still manageable, it is acceptable to keep everything in `page.tsx`, but extracted components are preferred for clarity.

## Product Name

Use this visible naming:

- Page title: `Vision Copilot`
- Subtitle: `Ask operational questions across cameras, alerts, zones, and evidence.`
- Sidebar label: `Vision Copilot`

Avoid long marketing text. This is an operational dashboard.

## Visual Direction

Use the existing dark dashboard style:

- Main background: slate / near-black
- Cards: `bg-slate-900`, `border-slate-800`
- Primary accent: blue or cyan
- Status accents:
  - Green for healthy / online
  - Amber for watch / medium risk
  - Red for critical / offline
  - Violet only as a small AI accent, not the dominant theme

Design rules:

- Keep cards at `rounded-lg` or less.
- Avoid oversized hero sections.
- Avoid decorative gradient blobs or generic illustrations.
- Use icons for actions and sections.
- Make controls compact but touch-friendly.
- Ensure text never overlaps or overflows on mobile.
- Use clear visual hierarchy: title, filters, metrics, workspace, details.

## Page Layout

Use this layout on desktop:

1. Header row
   - Left: title, subtitle, live status
   - Right: refresh button, export/share button if desired

2. Filter bar
   - Reuse `BIFilterBar` if possible
   - Add UI-only segmented control for:
     - `Site Overview`
     - `Camera Focus`
     - `Incident Review`

3. Metric strip
   Show 4 compact metrics:
   - `Active Cameras`
   - `Events Today`
   - `Risk Level`
   - `Avg Response`

4. Main workspace grid
   - Left side, about 65% width:
     - Scene intelligence panel
     - Selected camera preview mock
     - Detection overlays / pills
     - Timeline of recent visual events
   - Right side, about 35% width:
     - Copilot chat panel
     - Suggested prompts
     - Answer source/confidence card

5. Lower section
   - Camera grid with 6 mock camera tiles
   - Action queue / recommendations list

On mobile:

- Stack everything vertically.
- Header actions wrap cleanly.
- Camera grid becomes 1 column.
- Chat panel appears after the main scene panel.
- Avoid horizontal scrolling.

## Main UI Sections

### 1. Vision Copilot Header

Include:

- `Vision Copilot` title with an icon such as `Bot`, `Sparkles`, `ScanEye`, or `BrainCircuit`
- Small live badge: `Live UI Preview`
- Subtitle: `Ask operational questions across cameras, alerts, zones, and evidence.`
- Action buttons:
  - Refresh
  - Export

This is UI-only, so buttons can update local state or do nothing.

### 2. Metric Strip

Use compact cards, not oversized analytics blocks.

Example mock values:

- Active Cameras: `22 / 24`
- Events Today: `148`
- Risk Level: `Medium`
- Avg Response: `6m 42s`

Each metric should include:

- Icon
- Label
- Value
- Small trend/status text

### 3. Scene Intelligence Panel

This is the primary page focus.

Create a large card that looks like a video intelligence analysis area. Since this is UI-only, use a styled mock preview instead of real video.

Include:

- Selected camera name: `Main Gate - North Entry`
- Status: `Analyzing`
- Mock video area with dark background, subtle grid, and overlay boxes or chips
- Detection labels:
  - `Queue forming`
  - `Vehicle at gate`
  - `Crowd density: Normal`
  - `Camera confidence: 94%`
- A right or bottom mini summary:
  - `Current scene`
  - `Observed risk`
  - `Recommended action`

The mock video should look professional and intentional, not empty.

### 4. Copilot Chat Panel

Create a refined chat panel for asking questions.

Suggested prompts:

- `What changed at Main Gate today?`
- `Which camera needs attention first?`
- `Why did risk increase after 5 PM?`
- `Summarize evidence for open incidents.`
- `Which area has repeated alerts?`

Behavior:

- User can click a prompt and it appears as a user message.
- Show a canned assistant response.
- Input box at bottom.
- Send button with icon.
- Optional loading state for 700ms using local state.

Do not require backend for this.

Example assistant response:

`Main Gate shows a moderate queue pattern between 5:10 PM and 5:35 PM. Two repeated gate-hold events and one vehicle dwell event increased operational risk. Recommended action: assign one guard to the north entry during dispersal.`

### 5. Evidence Timeline

Show recent visual events in a timeline.

Example rows:

- `5:35 PM` - `Queue threshold crossed` - `Main Gate`
- `5:22 PM` - `Camera stream recovered` - `Parking East`
- `5:10 PM` - `Vehicle dwell detected` - `Main Gate`
- `4:48 PM` - `Restricted zone motion` - `Back Corridor`

Each row should include severity:

- Critical
- Watch
- Info
- Resolved

### 6. Camera Grid

Show 6 mock camera tiles:

- Main Gate - North Entry
- Parking East
- Back Corridor
- Lobby
- Playground
- Server Room

Each tile should include:

- Fake preview surface
- Status dot
- Camera name
- Last event time
- Risk badge

Clicking a camera tile should update the selected camera in local state.

### 7. Action Queue

Show operational recommendations:

- `Assign guard to Main Gate for dispersal`
- `Review Parking East stream drops`
- `Escalate repeated restricted zone motion`

Each item should include:

- Priority
- Owner placeholder
- CTA buttons/icons:
  - Approve
  - Dismiss

This can be UI-only with local state.

## Suggested Mock Data Shape

Use local constants in the page or a nearby component file.

```ts
type VisionCamera = {
  id: string;
  name: string;
  zone: string;
  status: 'online' | 'degraded' | 'offline';
  risk: 'low' | 'medium' | 'high';
  lastEvent: string;
  confidence: number;
};

type VisionEvent = {
  id: string;
  time: string;
  title: string;
  camera: string;
  severity: 'critical' | 'watch' | 'info' | 'resolved';
};

type VisionAction = {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  owner: string;
};
```

## Interaction Requirements

Implement these local UI interactions:

- Selecting a camera updates the scene panel title and metadata.
- Clicking a suggested prompt sends a mock user message.
- Sending text from the input appends the user message and a canned assistant response.
- Refresh button updates a small `Last refreshed` timestamp.
- Approve/Dismiss buttons in action queue update local state or visually mark an item.

No backend is needed.

## Accessibility

Make sure:

- Buttons have accessible labels or visible text.
- Icon-only buttons have `aria-label`.
- Inputs have placeholder text and clear focus styles.
- Color is not the only way to understand severity.
- Text contrast is readable on dark backgrounds.

## Acceptance Criteria

The implementation is complete when:

- `/dashboard/business-intelligence/copilot` shows the new Vision Copilot UI.
- Sidebar label says `Vision Copilot`.
- Page looks professional and modern.
- UI is responsive on desktop and mobile.
- All data is mocked locally.
- No backend/database changes are required.
- `npm run build` passes.
- No TypeScript errors are introduced.
- No text is clipped or overlapping.

## Verification Commands

Run:

```bash
npm run build
npm run dev
```

Then open:

```text
http://localhost:3002/dashboard/business-intelligence/copilot
```

Check desktop and mobile widths.

## Implementation Notes

- Use `lucide-react` icons such as `ScanEye`, `Camera`, `Bot`, `Sparkles`, `Activity`, `ShieldAlert`, `Clock`, `CheckCircle2`, `XCircle`, `RefreshCw`, `Send`, `Download`, and `CircleDot`.
- Prefer Tailwind utility classes already used in the repo.
- Reuse `BIFilterBar` for organization/site/date filtering unless it blocks the design.
- Keep the UI compact and dashboard-like.
- Avoid creating a marketing hero section.
- Avoid large blocks of explanatory text inside the app.
- Keep copy short and operational.
