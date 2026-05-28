import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchool } from '../school-foundation/seed';
import { seedSchoolDailySummariesPipeline } from '../school-daily-summaries/seed';
import { computeOverallScore } from './calculate';
import { mvp3DefaultWeights } from './flags';
import {
  calculateScoresForDay,
  createWeightProfile,
  getOverallScore,
  listModuleScores,
  listWeightProfiles,
  resetScoreEngineStore,
} from './store';
import { DEFAULT_WEIGHTS, MODULE_LABELS } from './weights';
import type { ScoreModuleKey } from './types';

const MODULE_KEYS: ScoreModuleKey[] = [
  'safety', 'security', 'teacher', 'occupancy', 'academic', 'staff', 'space', 'discipline', 'parent', 'compliance',
];

describe('Phase 5 acceptance gate', () => {
  it('computes all 10 score components for a seeded day', async () => {
    resetScoreEngineStore();
    const date = '2099-10-01';
    await seedDemoSchool(1);
    await seedSchoolDailySummariesPipeline(1, date);
    calculateScoresForDay(1, date);
    const rows = listModuleScores(1, date);
    assert.equal(rows.length, 10);
    for (const k of MODULE_KEYS) assert.ok(rows.some((r) => r.moduleKey === k), k);
  });

  it('overall matches docx weight formula with default profile', async () => {
    resetScoreEngineStore();
    const date = '2099-10-02';
    await seedDemoSchool(1);
    await seedSchoolDailySummariesPipeline(1, date);
    const { overall, modules } = calculateScoresForDay(1, date);
    const moduleMap = Object.fromEntries(modules.map((m) => [m.moduleKey, { score: m.score }])) as Record<ScoreModuleKey, { score: number }>;
    assert.equal(overall.overallScore, computeOverallScore(moduleMap, DEFAULT_WEIGHTS));
  });

  it('MVP3 subset overall uses redistributed weights only', () => {
    const moduleMap = Object.fromEntries(MODULE_KEYS.map((k, i) => [k, { score: 70 + i }])) as Record<ScoreModuleKey, { score: number }>;
    const mvp3 = computeOverallScore(moduleMap, mvp3DefaultWeights());
    assert.ok(mvp3 >= 0 && mvp3 <= 100);
  });

  it('re-run is reproducible and weight profile does not rewrite history', async () => {
    resetScoreEngineStore();
    const date = '2099-10-03';
    await seedDemoSchool(1);
    await seedSchoolDailySummariesPipeline(1, date);
    const a = calculateScoresForDay(1, date).overall.overallScore;
    assert.equal(calculateScoresForDay(1, date).overall.overallScore, a);
    createWeightProfile(1, '2099-10-04', { ...DEFAULT_WEIGHTS, teacher: 0.22 });
    assert.equal(getOverallScore(1, date)!.overallScore, a);
    assert.ok(listWeightProfiles(1).length >= 2);
  });

  it('score layer stores numeric drivers only (no GPT narrative fields)', async () => {
    resetScoreEngineStore();
    const date = '2099-10-04';
    await seedDemoSchool(1);
    await seedSchoolDailySummariesPipeline(1, date);
    const { modules } = calculateScoresForDay(1, date);
    for (const m of modules) {
      assert.ok(typeof m.score === 'number');
      for (const d of m.drivers) {
        assert.ok(!d.label.toLowerCase().includes('gpt'));
        assert.ok(MODULE_LABELS[m.moduleKey]);
      }
    }
  });
});
