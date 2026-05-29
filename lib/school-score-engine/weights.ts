import type { ScoreModuleKey } from './types';

/** Docx default: Safety 20% + Security 10% + eight modules = 70%. */
export const DEFAULT_WEIGHTS: Record<ScoreModuleKey, number> = {
  safety: 0.2,
  security: 0.1,
  teacher: 0.15,
  occupancy: 0.1,
  academic: 0.15,
  staff: 0.1,
  space: 0,
  discipline: 0.1,
  parent: 0.05,
  compliance: 0.05,
};

export const MODULE_LABELS: Record<ScoreModuleKey, string> = {
  safety: 'Safety',
  security: 'Security',
  teacher: 'Teacher & Staff Management',
  occupancy: 'Student Occupancy',
  academic: 'Academic Operations',
  staff: 'Staff Deployment',
  space: 'Space Utilization',
  discipline: 'Discipline',
  parent: 'Parent Experience',
  compliance: 'Compliance',
};

export function normalizeWeights(weights: Record<ScoreModuleKey, number>) {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (!sum) return { ...DEFAULT_WEIGHTS };
  const out = { ...weights };
  for (const k of Object.keys(out) as ScoreModuleKey[]) {
    out[k] = out[k] / sum;
  }
  return out;
}
