import type { DailySummaryModule } from '@/lib/school-daily-summaries/types';

/** Primary headline metric for daily-summary trend / week-compare charts per module. */
export const MODULE_TREND_METRIC: Partial<Record<DailySummaryModule, string>> = {
  teacher: 'conducted_pct',
  classroom: 'conducted_pct',
  occupancy: 'expected_match_pct',
  process: 'dispersal_congestion_min',
  parent: 'dispersal_congestion_min',
  staff: 'coverage_pct',
  space: 'avg_utilization_pct',
  discipline: 'running_count',
  compliance: 'violation_count',
};
