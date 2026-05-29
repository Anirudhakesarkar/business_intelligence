import type { ModuleScore, ScoreModuleKey } from '@/lib/school-score-engine/types';
import { DAILY_MODULE_TO_SCORE } from '@/lib/school-intelligence/module-routes';

const FALLBACK_BY_MODULE: Record<ScoreModuleKey, string[]> = {
  teacher: [
    'Track on-time teacher presence against the published timetable.',
    'Flag periods with late arrival or early exit from class.',
    'Prioritize rooms with repeated uncovered teaching windows.',
  ],
  occupancy: [
    'Compare headcount in room vs expected enrollment by period.',
    'Highlight zones above comfortable capacity during breaks.',
    'Review empty classrooms during scheduled teaching blocks.',
  ],
  academic: [
    'Measure periods conducted vs planned on the master timetable.',
    'Surface missed subjects or rooms without a conducting teacher.',
    'Correlate timetable gaps with corridor movement spikes.',
  ],
  staff: [
    'Match guard and coordinator duty roster to actual zone coverage.',
    'Identify duty windows with no assigned staff on camera.',
    'Review handoffs at gate, playground, and dispersal zones.',
  ],
  space: [
    'Rank rooms by utilization vs scheduled bookings.',
    'Spot double-booked or idle high-value spaces.',
    'Compare peak occupancy to room capacity limits.',
  ],
  discipline: [
    'Roll up corridor and playground behaviour incidents by severity.',
    'Track repeat locations for after-hours movement.',
    'Separate bell-time congestion from instructional disruptions.',
  ],
  parent: [
    'Monitor arrival queue length and average gate wait time.',
    'Watch dispersal bottlenecks against planned end-of-day windows.',
    'Alert when pickup patterns deviate from historical norms.',
  ],
  compliance: [
    'List restricted-zone entries outside approved supervision windows.',
    'Track lab and server-room access against waiver rules.',
    'Escalate repeated policy violations for leadership review.',
  ],
  safety: [
    'Weight campus-wide incident severity and response SLA adherence.',
    'Emphasize playground and stairwell activity during transitions.',
    'Include after-hours perimeter and entrance detections.',
  ],
  security: [
    'Score physical security posture from camera health and coverage.',
    'Highlight unresolved high-severity access or intrusion alerts.',
    'Track restricted-area breaches separately from general safety noise.',
  ],
};

const GENERIC_FALLBACK = [
  'Run Phase 4 aggregation to populate daily facts for this module.',
  'Calculate Phase 5 scores after foundation data and events are in sync.',
  'Open the module detail page for drill-downs and event evidence.',
];

export function buildFactsByScoreModule(
  modules: { module: string; facts: { text: string }[] }[],
): Map<ScoreModuleKey, { text: string }[]> {
  const map = new Map<ScoreModuleKey, { text: string }[]>();
  for (const row of modules) {
    const scoreKey = DAILY_MODULE_TO_SCORE[row.module];
    if (!scoreKey) continue;
    const prev = map.get(scoreKey) ?? [];
    map.set(scoreKey, [...prev, ...(row.facts ?? []).filter((f) => f.text?.trim())]);
  }
  return map;
}

/** At least three supporting lines: score drivers, then daily facts, then module defaults. */
export function moduleInsightBullets(
  moduleKey: ScoreModuleKey,
  moduleScore: ModuleScore | undefined,
  factsByScore: Map<ScoreModuleKey, { text: string }[]>,
  minCount = 3,
): string[] {
  const bullets: string[] = [];

  const pushUnique = (text: string) => {
    const t = text.trim();
    if (!t || bullets.includes(t)) return;
    bullets.push(t);
  };

  for (const d of moduleScore?.drivers ?? []) {
    pushUnique(d.detail ?? d.label);
    if (bullets.length >= minCount) return bullets;
  }

  for (const f of factsByScore.get(moduleKey) ?? []) {
    pushUnique(f.text);
    if (bullets.length >= minCount) return bullets;
  }

  if (moduleKey === 'security') {
    for (const f of factsByScore.get('safety') ?? []) {
      pushUnique(f.text);
      if (bullets.length >= minCount) return bullets;
    }
  }

  const fallbacks = FALLBACK_BY_MODULE[moduleKey] ?? GENERIC_FALLBACK;
  for (const line of fallbacks) {
    pushUnique(line);
    if (bullets.length >= minCount) break;
  }

  return bullets.slice(0, 5);
}

export function scoreDisplayStyle(score: number | null): {
  text: string;
  bar: string;
  ring: string;
  border: string;
  bg: string;
  badge: string;
} {
  if (score == null) {
    return {
      text: 'text-slate-400',
      bar: 'bg-slate-600',
      ring: '#475569',
      border: 'border-slate-800/80',
      bg: 'bg-slate-900/50',
      badge: 'bg-slate-800 text-slate-400 ring-slate-700',
    };
  }
  if (score >= 85) {
    return {
      text: 'text-emerald-300',
      bar: 'bg-emerald-500',
      ring: '#34d399',
      border: 'border-emerald-500/25',
      bg: 'bg-emerald-500/[0.06]',
      badge: 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30',
    };
  }
  if (score >= 70) {
    return {
      text: 'text-sky-300',
      bar: 'bg-sky-500',
      ring: '#38bdf8',
      border: 'border-sky-500/25',
      bg: 'bg-sky-500/[0.06]',
      badge: 'bg-sky-500/15 text-sky-200 ring-sky-500/30',
    };
  }
  if (score >= 55) {
    return {
      text: 'text-amber-300',
      bar: 'bg-amber-500',
      ring: '#fbbf24',
      border: 'border-amber-500/25',
      bg: 'bg-amber-500/[0.06]',
      badge: 'bg-amber-500/15 text-amber-200 ring-amber-500/30',
    };
  }
  return {
    text: 'text-rose-300',
    bar: 'bg-rose-500',
    ring: '#fb7185',
    border: 'border-rose-500/25',
    bg: 'bg-rose-500/[0.06]',
    badge: 'bg-rose-500/15 text-rose-200 ring-rose-500/30',
  };
}
