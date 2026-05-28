import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MVP3_SCORE_MODULES,
  MVP3_WEIGHT_STRATEGY_DOC,
  effectiveWeightsForOverall,
  mvp3DefaultWeights,
  mvp3ScoresOnly,
  visibleScoreModules,
} from './flags';
import { DEFAULT_WEIGHTS } from './weights';
import { computeOverallScore } from './calculate';
import type { ScoreModuleKey } from './types';

describe('school-score-engine MVP3', () => {
  it('exposes MVP3 module subset when flag enabled', () => {
    const prev = process.env.SCHOOL_MVP3_SCORES_ONLY;
    process.env.SCHOOL_MVP3_SCORES_ONLY = '1';
    try {
      assert.equal(mvp3ScoresOnly(), true);
      assert.deepEqual(visibleScoreModules(), MVP3_SCORE_MODULES);
      const w = effectiveWeightsForOverall(DEFAULT_WEIGHTS, true);
      const sum = MVP3_SCORE_MODULES.reduce((a, k) => a + w[k], 0);
      assert.ok(Math.abs(sum - 1) < 0.01);
      assert.equal(w.staff, 0);
      assert.ok(MVP3_WEIGHT_STRATEGY_DOC.includes('MVP3'));
    } finally {
      if (prev === undefined) delete process.env.SCHOOL_MVP3_SCORES_ONLY;
      else process.env.SCHOOL_MVP3_SCORES_ONLY = prev;
    }
  });

  it('mvp3 overall uses only four module weights', () => {
    const keys: ScoreModuleKey[] = [
      'safety', 'security', 'teacher', 'occupancy', 'academic', 'staff', 'space', 'discipline', 'parent', 'compliance',
    ];
    const modules = Object.fromEntries(
      keys.map((k) => [k, { score: k === 'staff' || k === 'discipline' ? 40 : 80 }])
    ) as Record<ScoreModuleKey, { score: number }>;
    const full = computeOverallScore(modules, DEFAULT_WEIGHTS);
    const mvp3 = computeOverallScore(modules, mvp3DefaultWeights());
    assert.notEqual(full, mvp3);
    assert.ok(mvp3 >= 0 && mvp3 <= 100);
  });
});
