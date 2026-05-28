import { seedDemoSchool } from '../school-foundation/seed';
import { seedDemoAiSignals } from '../school-ai-signals/seed';
import { evaluateRules, seedDefaultRules } from '../school-rule-engine/store';
import { aggregateDay, resetDailySummariesStore } from './store';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function seedSchoolDailySummariesPipeline(organizationId = 1, date?: string) {
  const d = date ?? todayIso();
  resetDailySummariesStore();
  const foundation = seedDemoSchool(organizationId);
  const ai = seedDemoAiSignals(organizationId);
  const rules = seedDefaultRules(organizationId);
  const evaluation = evaluateRules(organizationId);
  const aggregation = aggregateDay(organizationId, d);
  return { organizationId, date: d, foundation, ai, rules, evaluation, aggregation };
}

export function seedAggregateToday(organizationId = 1) {
  return aggregateDay(organizationId, todayIso());
}
