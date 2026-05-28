import type { ScoreModuleKey } from './types';
import { DEFAULT_WEIGHTS } from './weights';

export const MVP3_SCORE_MODULES: ScoreModuleKey[] = ['teacher', 'occupancy', 'academic', 'parent'];

export function mvp3ScoresOnly() {
  return process.env.SCHOOL_MVP3_SCORES_ONLY === '1' || process.env.NEXT_PUBLIC_SCHOOL_MVP3_SCORES_ONLY === '1';
}

/** Visible module keys for UI (MVP3 subset or full platform). */
export function visibleScoreModules(): ScoreModuleKey[] {
  if (mvp3ScoresOnly()) return [...MVP3_SCORE_MODULES];
  return [
    'safety', 'security', 'teacher', 'occupancy', 'academic', 'staff', 'space', 'discipline', 'parent', 'compliance',
  ];
}

/**
 * When MVP3-only: redistribute weights across Teacher, Occupancy, Academic, Parent.
 * Safety/Security/Staff/Space/Discipline/Compliance stay in store at score 100 but weight 0 in overall.
 */
export function effectiveWeightsForOverall(
  weights: Record<ScoreModuleKey, number>,
  mvp3Only = mvp3ScoresOnly()
): Record<ScoreModuleKey, number> {
  if (!mvp3Only) return weights;
  const out = { ...weights };
  for (const k of Object.keys(out) as ScoreModuleKey[]) {
    if (!MVP3_SCORE_MODULES.includes(k)) out[k] = 0;
  }
  let sum = MVP3_SCORE_MODULES.reduce((a, k) => a + (weights[k] ?? 0), 0);
  if (!sum) {
    const even = 1 / MVP3_SCORE_MODULES.length;
    for (const k of MVP3_SCORE_MODULES) out[k] = even;
    return out;
  }
  for (const k of MVP3_SCORE_MODULES) out[k] = (weights[k] ?? 0) / sum;
  return out;
}

export const MVP3_WEIGHT_STRATEGY_DOC =
  'MVP3 mode: overall uses Teacher, Occupancy, Academic, and Parent weights only (redistributed to 100%). Safety, Security, Staff, Space, Discipline, and Compliance scores are still computed but excluded from overall until full platform is enabled.';

export function mvp3DefaultWeights(): Record<ScoreModuleKey, number> {
  const base = { ...DEFAULT_WEIGHTS };
  return effectiveWeightsForOverall(base, true);
}
