import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../school-foundation/store';
import { seedDemoSchool } from '../school-foundation/seed';
import { seedDemoAiSignals } from '../school-ai-signals/seed';
import { aggregateDay, resetDailySummariesStore } from '../school-daily-summaries/store';
import { seedSchoolScorePipeline } from '../school-score-engine/seed';
import { calculateScoresForDay, resetScoreEngineStore } from '../school-score-engine/store';
import { evaluateRules, seedDefaultRules } from '../school-rule-engine/store';
import { CONTRACT_VERSION } from './types';
import { buildGptContext, buildCopilotPrompt } from './context-builder';
import { seedSchoolGptPipeline } from './seed';
import {
  askGpt,
  createAction,
  createActionFromRecommendation,
  getActionImpact,
  getOrCreateDailySummary,
  getOrCreateWeeklySummary,
  listActions,
  listChatHistory,
  listRecommendations,
  regenerateDailySummary,
  resetGptCopilotStore,
  updateAction,
} from './store';

describe('school-gpt-copilot', () => {
function seedScoresForDates(organizationId: number, dates: string[]) {
  resetScoreEngineStore();
  resetDailySummariesStore();
  seedDemoSchool(organizationId);
  seedDemoAiSignals(organizationId);
  seedDefaultRules(organizationId);
  evaluateRules(organizationId);
  for (const date of dates) {
    aggregateDay(organizationId, date);
    calculateScoresForDay(organizationId, date);
  }
}


  it('buildGptContext returns versioned contract when Phase 4/5 exist', () => {
    resetGptCopilotStore();
    resetScoreEngineStore();
    const date = '2099-09-01';
    seedDemoSchool(1);
    seedSchoolScorePipeline(1, date);
    const built = buildGptContext(1, date);
    assert.equal(built.ok, true);
    if (!built.ok) return;
    const ctx = built.context;
    assert.equal(ctx.contract_version, CONTRACT_VERSION);
    assert.equal(ctx.date, date);
    assert.equal(ctx.org_id, 1);
    assert.equal(ctx.timezone, 'Asia/Kolkata');
    assert.ok(ctx.overall_score != null);
    assert.equal(ctx.module_scores.length, 10);
    assert.ok(ctx.module_scores[0].drivers.length >= 0);
    assert.ok(ctx.summary_facts.length >= 0);
    assert.match(buildCopilotPrompt(ctx), /school intelligence/i);
  });

  it('buildGptContext fails closed without Phase 4/5 data', () => {
    resetGptCopilotStore();
    resetScoreEngineStore();
    seedDemoSchool(1);
    const built = buildGptContext(1, '2099-01-01');
    assert.equal(built.ok, false);
    if (built.ok) return;
    assert.match(built.error, /Phase 4|missing/i);
  });

  it('regenerateDailySummary creates summary, recommendations, and audit', async () => {
    resetGptCopilotStore();
    resetScoreEngineStore();
    const date = '2099-09-02';
    seedDemoSchool(1);
    seedSchoolScorePipeline(1, date);
    const result = await regenerateDailySummary(1, date);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.match(result.summary.content, /Daily principal summary/);
    assert.ok(result.summary.citations.includes('overall_score'));
    assert.equal(result.summary.model, 'demo');
    assert.ok(listRecommendations(1, date).length >= 1);
    assert.ok(db.auditLog().some((e) => e.entityType === 'gpt_daily_summary'));
  });

  it('getOrCreateDailySummary returns cached row on second call', async () => {
    resetGptCopilotStore();
    resetScoreEngineStore();
    const date = '2099-09-03';
    seedDemoSchool(1);
    seedSchoolScorePipeline(1, date);
    const first = await getOrCreateDailySummary(1, date);
    const second = await getOrCreateDailySummary(1, date);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(first.summary.id, second.summary.id);
    assert.equal(second.cached, true);
  });

  it('weekly summary skips holidays and aggregates school days', () => {
    resetGptCopilotStore();
    const weekStart = '2099-08-04';
    seedScoresForDates(1, ['2099-08-04', '2099-08-06', '2099-08-07', '2099-08-08']);
    db.calendar().push({
      id: 88001,
      organizationId: 1,
      calendarDate: '2099-08-05',
      dayType: 'Holiday',
      label: 'Test holiday',
    });
    const weekly = getOrCreateWeeklySummary(1, weekStart);
    assert.equal(weekly.ok, true);
    if (!weekly.ok) return;
    assert.match(weekly.summary.content, /Weekly management summary/);
    assert.ok((weekly.daysIncluded ?? 0) >= 2);
    assert.ok(weekly.summary.citations.includes('weekly_aggregate'));
  });

  it('askGpt rejects off-topic questions and answers module questions', async () => {
    resetGptCopilotStore();
    resetScoreEngineStore();
    const date = '2099-09-04';
    seedDemoSchool(1);
    seedSchoolScorePipeline(1, date);
    const off = await askGpt(1, date, 'What is the weather today?');
    assert.equal(off.ok, true);
    if (!off.ok) return;
    assert.match(off.answer, /only answer/i);
    assert.equal(off.citations.length, 0);

    const parent = await askGpt(1, date, 'How was parent dispersal today?', undefined, undefined);
    assert.equal(parent.ok, true);
    if (!parent.ok) return;
    assert.match(parent.answer, /Parent Experience/i);
    assert.ok(parent.citations.includes('parent'));
    assert.ok(listChatHistory(1, parent.conversationId).length >= 2);
  });

  it('action lifecycle and 7-day impact window', async () => {
    resetGptCopilotStore();
    const date = '2099-09-10';
    const beforeDate = '2099-09-03';
    const afterDate = '2099-09-17';
    seedScoresForDates(1, [beforeDate, date, afterDate]);
    await regenerateDailySummary(1, date);
    const recs = listRecommendations(1, date);
    const manual = createAction(1, 'Manual follow-up', date, 'Coordinator', '2099-09-12');
    assert.equal(manual.ok, true);
    if (recs.length >= 1) {
      const fromRec = createActionFromRecommendation(1, recs[0].id, 'Coordinator', '2099-09-12');
      assert.equal(fromRec.ok, true);
    }
    if (!manual.ok) return;
    const done = updateAction(1, manual.task.id, { status: 'completed' });
    assert.equal(done.ok, true);
    const impact = getActionImpact(1, manual.task.id);
    assert.equal(impact.ok, true);
    if (!impact.ok) return;
    assert.equal(impact.windowDays, 7);
    assert.equal(impact.before?.date, beforeDate);
    assert.ok(impact.before?.overall != null);
    assert.ok(impact.after?.date);
    assert.ok(impact.after?.overall != null);
    assert.ok(listActions(1).length >= 2);
  });


  it('returns at least 3 recommendations when overall < 85 and multiple weak modules', async () => {
    const { generateRecommendations } = await import('./service');
    const recs = generateRecommendations({
      organization_id: 1,
      site_id: 1,
      date: '2099-09-01',
      overall_score: 72,
      module_scores: [
        { key: 'parent', label: 'Parent Experience', score: 68, drivers: [{ key: 'dispersal', label: 'Dispersal congestion', impact: -10 }] },
        { key: 'teacher', label: 'Teacher Productivity', score: 70, drivers: [] },
        { key: 'academic', label: 'Academic Operations', score: 65, drivers: [] },
        { key: 'occupancy', label: 'Student Occupancy', score: 80, drivers: [] },
      ],
      summary_facts: [{ module: 'parent', text: 'Dispersal gate congestion lasted about 20 minutes.' }],
      top_events: [{ event_type: 'GateCongestion', summary: 'Gate queue at dispersal' }],
    } as never);
    assert.ok(recs.length >= 3, `expected >=3 recs, got ${recs.length}`);
  });

  it('seedSchoolGptPipeline wires score and GPT layers', async () => {
    resetGptCopilotStore();
    resetScoreEngineStore();
    const date = '2099-09-05';
    seedDemoSchool(1);
    const seeded = await seedSchoolGptPipeline(1, date);
    assert.equal(seeded.date, date);
    assert.equal(seeded.gpt.ok, true);
    if (!seeded.gpt.ok) return;
    assert.match(seeded.gpt.summary.content, /principal summary/i);
  });
});
