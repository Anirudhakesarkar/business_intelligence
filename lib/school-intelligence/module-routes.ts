import type { ScoreModuleKey } from '@/lib/school-score-engine/types';

export const MODULE_PAGE_HREFS: Record<ScoreModuleKey, string> = {
  safety: '/dashboard/school-intelligence/campus-safety',
  security: '/dashboard/school-intelligence/campus-safety',
  teacher: '/dashboard/school-intelligence/teacher-productivity',
  occupancy: '/dashboard/school-intelligence/student-occupancy',
  academic: '/dashboard/school-intelligence/academic-operations',
  staff: '/dashboard/school-intelligence/staff-deployment',
  space: '/dashboard/school-intelligence/space-utilization',
  discipline: '/dashboard/school-intelligence/discipline',
  parent: '/dashboard/school-intelligence/parent-experience',
  compliance: '/dashboard/school-intelligence/compliance',
};

/** Daily summary module keys → Phase 5 score module keys. */
export const DAILY_MODULE_TO_SCORE: Record<string, ScoreModuleKey> = {
  teacher: 'teacher',
  classroom: 'academic',
  occupancy: 'occupancy',
  staff: 'staff',
  space: 'space',
  discipline: 'discipline',
  parent: 'parent',
  process: 'parent',
  compliance: 'compliance',
  school: 'safety',
};
