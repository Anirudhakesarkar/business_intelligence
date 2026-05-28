import { getSetupHealth } from '../school-foundation/store';
import { seedDemoSchool } from '../school-foundation/seed';
import { seedDemoAiSignals } from '../school-ai-signals/seed';
import { evaluateRules, seedDefaultRules } from '../school-rule-engine/store';
import { aggregateDay } from '../school-daily-summaries/store';
import { calculateScoresForDay } from '../school-score-engine/store';
import { regenerateDailySummary } from '../school-gpt-copilot/store';
import { saveSnapshot } from '../school-persistence/snapshot';

export type RunDailyJobOptions = {
  organizationId?: number;
  date?: string;
  seedIfEmpty?: boolean;
  includeGpt?: boolean;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function runDailySchoolIntelligenceJob(opts: RunDailyJobOptions = {}) {
  const organizationId = opts.organizationId ?? 1;
  const date = opts.date ?? todayIso();
  const seedIfEmpty = opts.seedIfEmpty !== false;

  let foundation = getSetupHealth(organizationId);
  if (seedIfEmpty && !foundation.isReadyForPhase2) {
    seedDemoSchool(organizationId);
    foundation = getSetupHealth(organizationId);
  }

  seedDefaultRules(organizationId);
  const signals = seedDemoAiSignals(organizationId);
  const evaluation = evaluateRules(organizationId, { from: `${date}T00:00:00.000Z`, to: `${date}T23:59:59.999Z` });
  const aggregation = aggregateDay(organizationId, date);
  const scores = calculateScoresForDay(organizationId, date);
  const gpt = opts.includeGpt !== false ? regenerateDailySummary(organizationId, date) : null;
  const snapshot = saveSnapshot();

  return {
    ok: true,
    organizationId,
    date,
    foundation,
    signals: { ingested: signals.signals },
    evaluation,
    aggregation,
    scores,
    gpt,
    snapshot,
  };
}
