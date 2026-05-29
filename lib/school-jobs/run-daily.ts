import { getSetupHealth } from '../school-foundation/store';
import { evaluateRules, seedDefaultRules } from '../school-rule-engine/store';
import { aggregateDayPersisted } from '../school-daily-summaries/store';
import { calculateScoresForDay } from '../school-score-engine/store';
import { regenerateDailySummary } from '../school-gpt-copilot/store';
import { saveSnapshot } from '../school-persistence/snapshot';
import { persistOperationalIntelligenceForOrg } from '../school-db/persist-operational-intelligence';
import { loadEventsFromPg } from '../school-db/load-events';

export type RunDailyJobOptions = {
  organizationId?: number;
  date?: string;
  includeGpt?: boolean;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Runs the School Intelligence daily pipeline (Phases 3–6) against real data.
 *
 * Phase 1 (foundation) must be populated via School Management UI.
 * Phase 2 (AI signals) must come from real AI workers via POST /api/ai-signals.
 * No demo or seed data is injected automatically.
 */
export async function runDailySchoolIntelligenceJob(opts: RunDailyJobOptions = {}) {
  const organizationId = opts.organizationId ?? 1;
  const date = opts.date ?? todayIso();

  const foundation = getSetupHealth(organizationId);

  // Load persisted events from Postgres into in-memory rule engine store
  await loadEventsFromPg(organizationId);

  // Phase 3: Evaluate real AI signals against configured rules
  seedDefaultRules(organizationId);
  const evaluation = evaluateRules(organizationId, {
    from: `${date}T00:00:00.000Z`,
    to: `${date}T23:59:59.999Z`,
  });

  // Phase 4: Aggregate daily summaries from rule engine events
  const aggregation = await aggregateDayPersisted(organizationId, date);

  // Phase 5: Calculate module scores
  const scores = calculateScoresForDay(organizationId, date);

  // Phase 6: GPT summary (requires OPENAI_API_KEY)
  const gpt = opts.includeGpt !== false ? await regenerateDailySummary(organizationId, date) : null;

  await persistOperationalIntelligenceForOrg(organizationId);
  const snapshot = saveSnapshot();

  return {
    ok: true,
    organizationId,
    date,
    foundation,
    signals: { ingested: 0 },
    evaluation,
    aggregation,
    scores,
    gpt,
    snapshot,
  };
}
