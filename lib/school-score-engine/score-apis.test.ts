import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../school-foundation/store';
import { seedDemoSchool } from '../school-foundation/seed';
import { seedSchoolDailySummariesPipeline } from '../school-daily-summaries/seed';
import {
  calculateScoresForDay,
  createWeightProfile,
  getOverallCompare,
  getOverallScore,
  getOverallTrend,
  listModuleScores,
  listWeightProfiles,
  resetScoreEngineStore,
} from './store';
import { DEFAULT_WEIGHTS } from './weights';

describe('school-score-engine APIs', () => {
  it('calculates ten module scores and overall for seeded date', async () => {
    resetScoreEngineStore();
    const date = '2099-07-10';
    await seedDemoSchool(1);
    await seedSchoolDailySummariesPipeline(1, date);
    const result = calculateScoresForDay(1, date);
    assert.equal(result.skipped, false);
    assert.ok(result.overall!.overallScore >= 0);
    assert.equal(listModuleScores(1, date).length, 10);
  });

  it('idempotent re-run produces same overall score', async () => {
    resetScoreEngineStore();
    const date = '2099-07-11';
    await seedDemoSchool(1);
    await seedSchoolDailySummariesPipeline(1, date);
    const _ra = calculateScoresForDay(1, date);
    const _rb = calculateScoresForDay(1, date);
    const a = _ra.overall!.overallScore;
    const b = _rb.overall!.overallScore;
    assert.equal(a, b);
  });

  it('weight profile versioning does not rewrite past scores', async () => {
    resetScoreEngineStore();
    const date = '2099-07-12';
    await seedDemoSchool(1);
    await seedSchoolDailySummariesPipeline(1, date);
    calculateScoresForDay(1, date);
    const before = getOverallScore(1, date)!.overallScore;
    createWeightProfile(1, '2099-07-13', { ...DEFAULT_WEIGHTS, teacher: 0.3 });
    const after = getOverallScore(1, date)!.overallScore;
    assert.equal(before, after);
    assert.ok(listWeightProfiles(1).length >= 2);
    assert.ok(db.auditLog().some((e) => e.entityType === 'score_weight_profile'));
  });

  it('overall trend and compare return historical points', async () => {
    resetScoreEngineStore();
    const date = '2099-07-15';
    await seedDemoSchool(1);
    await seedSchoolDailySummariesPipeline(1, date);
    calculateScoresForDay(1, date);
    await seedSchoolDailySummariesPipeline(1, '2099-07-14');
    calculateScoresForDay(1, '2099-07-14');
    const trend = getOverallTrend(1, date, 3);
    assert.equal(trend.points.length, 3);
    const cmp = getOverallCompare(1, date);
    assert.ok(cmp.current);
    assert.ok('delta' in cmp);
  });
});
