/** Client-safe MVP3 score visibility (mirrors lib/school-score-engine/flags.ts). */
export const MVP3_SCORE_MODULE_KEYS = ['teacher', 'occupancy', 'academic', 'parent'] as const;

export function isMvp3ScoresOnlyClient() {
  return process.env.NEXT_PUBLIC_SCHOOL_MVP3_SCORES_ONLY === '1';
}

export function visibleScoreModuleKeysClient(): string[] {
  if (isMvp3ScoresOnlyClient()) return [...MVP3_SCORE_MODULE_KEYS];
  return [
    'safety', 'security', 'teacher', 'occupancy', 'academic', 'staff', 'space', 'discipline', 'parent', 'compliance',
  ];
}
