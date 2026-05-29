import { DEFAULT_WEIGHTS } from '@/lib/school-score-engine/weights';
import type { DailyOverallScore, ModuleScore, ScoreModuleKey } from '@/lib/school-score-engine/types';
import type { SIDateRange } from './types';

export type ModuleScoreCompare = {
  moduleKey: ScoreModuleKey;
  current: number | null;
  prior: number | null;
  delta: number | null;
};

/** Demo current vs prior scores — mix of up (green) and down (red) for UI preview. */
const DEMO_SCORE_PAIRS: Record<ScoreModuleKey, { current: number; prior: number }> = {
  teacher: { current: 84, prior: 76 },
  occupancy: { current: 67, prior: 73 },
  academic: { current: 91, prior: 88 },
  parent: { current: 72, prior: 78 },
  safety: { current: 61, prior: 70 },
  security: { current: 80, prior: 72 },
  staff: { current: 75, prior: 75 },
  space: { current: 69, prior: 64 },
  discipline: { current: 55, prior: 62 },
  compliance: { current: 88, prior: 85 },
};

/** Small shift when date range changes so the filter feels live in demo mode. */
const RANGE_SCORE_NUDGE: Record<SIDateRange, number> = {
  '24h': 2,
  '7d': 0,
  '30d': -3,
  custom: -1,
};

function nudgeScore(value: number, dateRange: SIDateRange): number {
  const nudged = value + RANGE_SCORE_NUDGE[dateRange];
  return Math.min(100, Math.max(0, Math.round(nudged)));
}

function demoPair(moduleKey: ScoreModuleKey, dateRange: SIDateRange) {
  const base = DEMO_SCORE_PAIRS[moduleKey];
  const current = nudgeScore(base.current, dateRange);
  const prior = base.prior;
  return { current, prior, delta: current - prior };
}

function demoModuleRow(
  moduleKey: ScoreModuleKey,
  date: string,
  dateRange: SIDateRange
): ModuleScore {
  const { current } = demoPair(moduleKey, dateRange);
  return {
    id: 0,
    organizationId: 1,
    scoreDate: date,
    moduleKey,
    score: current,
    drivers: [],
    weightProfileId: 1,
    createdAt: new Date().toISOString(),
  };
}

export function isSchoolScoreDemoEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SCHOOL_SCORE_DEMO !== '0';
}

export function buildDemoOverallScore(
  date: string,
  dateRange: SIDateRange = '7d',
  moduleKeys: ScoreModuleKey[] = Object.keys(DEMO_SCORE_PAIRS) as ScoreModuleKey[]
): DailyOverallScore {
  const moduleScores = moduleKeys.map((k) => demoModuleRow(k, date, dateRange));
  const overallScore = Math.round(
    moduleScores.reduce((sum, m) => sum + m.score, 0) / Math.max(1, moduleScores.length)
  );

  return {
    id: 0,
    organizationId: 1,
    scoreDate: date,
    overallScore,
    weightProfileId: 1,
    moduleScores,
    weights: DEFAULT_WEIGHTS,
    createdAt: new Date().toISOString(),
  };
}

export function buildDemoModuleCompare(
  dateRange: SIDateRange = '7d',
  moduleKeys: ScoreModuleKey[] = Object.keys(DEMO_SCORE_PAIRS) as ScoreModuleKey[]
): ModuleScoreCompare[] {
  return moduleKeys.map((moduleKey) => {
    const { current, prior, delta } = demoPair(moduleKey, dateRange);
    return { moduleKey, current, prior, delta };
  });
}

export function buildDemoScoreCompare(
  date: string,
  priorDate: string,
  dateRange: SIDateRange = '7d',
  moduleKeys?: ScoreModuleKey[]
): { date: string; priorDate: string; moduleDeltas: ModuleScoreCompare[] } {
  return {
    date,
    priorDate,
    moduleDeltas: buildDemoModuleCompare(dateRange, moduleKeys),
  };
}

/** Fill missing module scores / deltas from demo data. */
export function mergeWithDemoOverall(
  live: DailyOverallScore | null,
  date: string,
  dateRange: SIDateRange,
  visibleModules: ScoreModuleKey[]
): DailyOverallScore {
  const demo = buildDemoOverallScore(date, dateRange, visibleModules);
  if (!live?.moduleScores?.length) return demo;

  const byKey = new Map(live.moduleScores.map((m) => [m.moduleKey, m]));
  for (const key of visibleModules) {
    if (!byKey.has(key) || byKey.get(key)!.score == null) {
      byKey.set(key, demoModuleRow(key, date, dateRange));
    }
  }

  return {
    ...live,
    moduleScores: visibleModules.map((k) => byKey.get(k)!),
    overallScore: live.overallScore ?? demo.overallScore,
  };
}

export function mergeWithDemoCompare(
  live: ModuleScoreCompare[],
  dateRange: SIDateRange,
  visibleModules: ScoreModuleKey[]
): ModuleScoreCompare[] {
  const demo = buildDemoModuleCompare(dateRange, visibleModules);
  const byKey = new Map(live.map((m) => [m.moduleKey, m]));

  return visibleModules.map((moduleKey) => {
    const row = byKey.get(moduleKey);
    if (row?.delta != null && row.current != null && row.prior != null) return row;
    return demo.find((d) => d.moduleKey === moduleKey)!;
  });
}
