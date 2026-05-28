import { seedSchoolScorePipeline } from '../school-score-engine/seed';
import { regenerateDailySummary, resetGptCopilotStore } from './store';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export async function seedSchoolGptPipeline(organizationId = 1, date?: string) {
  const d = date ?? todayIso();
  resetGptCopilotStore();
  const pipeline = await seedSchoolScorePipeline(organizationId, d);
  const gpt = await regenerateDailySummary(organizationId, d);
  return { organizationId, date: d, pipeline, gpt };
}
