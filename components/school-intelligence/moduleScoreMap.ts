import type { DailySummaryModule } from '@/lib/school-daily-summaries/types';
import type { ScoreModuleKey } from '@/lib/school-score-engine/types';

export const DAILY_TO_SCORE_MODULE: Partial<Record<DailySummaryModule, ScoreModuleKey>> = {
  teacher: 'teacher',
  classroom: 'academic',
  occupancy: 'occupancy',
  process: 'parent',
  staff: 'staff',
  space: 'space',
  discipline: 'discipline',
  parent: 'parent',
  compliance: 'compliance',
  school: undefined,
};
