import type { ScoreModuleKey } from './types';
import { getModuleScore } from './store';
import { getModuleDailySummary, getModuleMetricEvents } from '../school-daily-summaries/store';
import type { DailySummaryModule } from '../school-daily-summaries/types';

const SCORE_TO_DAILY: Partial<Record<ScoreModuleKey, DailySummaryModule>> = {
  teacher: 'teacher', occupancy: 'occupancy', academic: 'classroom', staff: 'staff', space: 'space',
  discipline: 'discipline', parent: 'parent', compliance: 'compliance', safety: 'compliance', security: 'compliance',
};

const DRIVER_METRIC: Record<string, string> = {
  gaps: 'supervision', conducted: 'conducted', presence: 'presence', over: 'overcrowding', empty: 'empty',
};

export function getScoreDrilldown(organizationId: number, date: string, moduleKey: ScoreModuleKey, driverKey?: string) {
  const score = getModuleScore(organizationId, date, moduleKey);
  const dailyModule = SCORE_TO_DAILY[moduleKey];
  const summary = dailyModule ? getModuleDailySummary(dailyModule, organizationId, date) : null;
  const metric = driverKey ? (DRIVER_METRIC[driverKey] ?? driverKey) : undefined;
  const events = dailyModule ? getModuleMetricEvents(dailyModule, organizationId, date, metric) : { events: [] };
  const driver = driverKey ? score?.drivers.find((d) => d.key === driverKey) : undefined;
  return {
    trace: ['score', 'daily_fact', 'event', 'signal_evidence'] as const,
    moduleKey, date, organizationId,
    score: score ?? null, driver: driver ?? null, dailySummary: summary,
    events: events.events?.slice(0, 25) ?? [], eventCount: events.events?.length ?? 0,
  };
}
