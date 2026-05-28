import { seedSchoolDailySummariesPipeline } from '../school-daily-summaries/seed';
import { calculateScoresForDay, resetScoreEngineStore } from './store';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function seedSchoolScorePipeline(organizationId = 1, date?: string) {
  const d = date ?? todayIso();
  resetScoreEngineStore();
  const pipeline = seedSchoolDailySummariesPipeline(organizationId, d);
  const scores = calculateScoresForDay(organizationId, d);
  return { organizationId, date: d, pipeline, scores };
}
