import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../school-foundation/store';
import { seedDemoSchool } from '../school-foundation/seed';
import { seedSchoolScorePipeline } from '../school-score-engine/seed';
import { calculateScoresForDay, resetScoreEngineStore } from '../school-score-engine/store';
import { aggregateDay, resetDailySummariesStore } from '../school-daily-summaries/store';
import { evaluateRules, seedDefaultRules } from '../school-rule-engine/store';
import { seedDemoAiSignals } from '../school-ai-signals/seed';
import { getPipelinePhaseStatus, assertGptAfterScores, assertScoresAfterSummaries } from '../school-intelligence/pipeline-order';
import { buildGptContext } from './context-builder';
import { filterVerifiableCitations, verifyCitationsAgainstContext } from './citation-verify';
import {
  askGpt,
  createAction,
  createActionFromRecommendation,
  listRecommendations,
  regenerateDailySummary,
  resetGptCopilotStore,
  updateAction,
} from './store';

describe('phase6 e2e acceptance gate', () => {
  it('citations are verifiable against prepared context (DB contract)', async () => {
    resetGptCopilotStore();
    resetScoreEngineStore();
    const date = '2099-10-01';
    seedDemoSchool(1);
    seedSchoolScorePipeline(1, date);
    const built = buildGptContext(1, date);
    assert.equal(built.ok, true);
    if (!built.ok) return;

    const result = await regenerateDailySummary(1, date);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const verified = verifyCitationsAgainstContext(built.context, result.summary.citations);
    assert.equal(verified.ok, true, `invalid citations: ${verified.invalid.join(', ')}`);
    assert.deepEqual(result.summary.citations, filterVerifiableCitations(built.context, result.summary.citations));

    for (const rec of listRecommendations(1, date)) {
      const recVerified = verifyCitationsAgainstContext(built.context, rec.citations);
      assert.equal(recVerified.ok, true, `rec ${rec.id}: ${recVerified.invalid.join(', ')}`);
    }

    const qa = await askGpt(1, date, 'How was parent dispersal today?');
    assert.equal(qa.ok, true);
    if (!qa.ok) return;
    const qaVerified = verifyCitationsAgainstContext(built.context, qa.citations);
    assert.equal(qaVerified.ok, true, `qa citations: ${qaVerified.invalid.join(', ')}`);
  });

  it('enforces rules → summaries → scores → GPT pipeline order', () => {
    resetGptCopilotStore();
    resetScoreEngineStore();
    resetDailySummariesStore();
    const date = '2099-10-02';
    seedDemoSchool(1);
    seedDemoAiSignals(1);
    seedDefaultRules(1);

    let status = getPipelinePhaseStatus(1, date);
    assert.equal(status.phase4_summaries, false);
    assert.equal(status.phase5_scores, false);
    assert.equal(status.gpt_ready, false);
    assert.match(assertGptAfterScores(1, date) ?? '', /Phase 4|summaries/i);

    const evaluation = evaluateRules(1, { from: `${date}T00:00:00.000Z`, to: `${date}T23:59:59.999Z` });
    assert.ok((!evaluation.skipped ? evaluation.created : 0) >= 0);

    aggregateDay(1, date);
    status = getPipelinePhaseStatus(1, date);
    assert.equal(status.phase4_summaries, true);
    assert.match(assertGptAfterScores(1, date) ?? '', /Phase 5|scores/i);

    calculateScoresForDay(1, date);
    status = getPipelinePhaseStatus(1, date);
    assert.equal(status.gpt_ready, true);
    assert.equal(assertGptAfterScores(1, date), null);
    assert.equal(assertScoresAfterSummaries(1, date), null);

    const gptBlocked = buildGptContext(1, '2099-01-99');
    assert.equal(gptBlocked.ok, false);
  });

  it('audits sensitive GPT actions (summary, Q&A, actions)', async () => {
    resetGptCopilotStore();
    resetScoreEngineStore();
    const date = '2099-10-03';
    seedDemoSchool(1);
    seedSchoolScorePipeline(1, date);
    const before = db.auditLog().length;

    await regenerateDailySummary(1, date);
    await askGpt(1, date, 'How was teacher productivity?');
    const recs = listRecommendations(1, date);
    const manual = createAction(1, 'Audit test action', date, 'Lead', date);
    assert.equal(manual.ok, true);
    if (recs.length) createActionFromRecommendation(1, recs[0].id, 'Lead', date);
    if (manual.ok) updateAction(1, manual.task.id, { status: 'completed' });

    const recent = db.auditLog().slice(before);
    const types = new Set(recent.map((e) => e.entityType));
    for (const entity of ['gpt_daily_summary', 'gpt_chat', 'gpt_action']) {
      assert.ok(types.has(entity), `missing audit for ${entity}`);
    }
  });
});
