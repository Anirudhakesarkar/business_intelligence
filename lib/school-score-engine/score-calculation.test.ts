import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTeacherScore,
  computeOccupancyScore,
  computeAcademicScore,
  computeParentScore,
  computeOverallScore,
  computeAllModuleScores,
} from './calculate';
import { DEFAULT_WEIGHTS } from './weights';
import type { ScoreInputsBundle } from './types';

const fixture: ScoreInputsBundle = {
  teacher: {
    conducted_pct: 88,
    presence_pct: 90,
    on_time_pct: 85,
    teaching_zone_activity: 78,
    gap_count: 2,
    early_exit_count: 1,
  },
  occupancy: { expected_match: 92, overcrowding_count: 1, underuse_count: 0, empty_room_count: 0 },
  classroom: { conducted_pct: 90, late_count: 1, missed_count: 0 },
  parent: { arrival_smooth_score: 88, dispersal_congestion_min: 12, overlap_count: 1, delay_min: 5 },
  staff: { coverage_pct: 94 },
  space: { avg_utilization_pct: 62 },
  discipline: { running_count: 1, loitering_count: 0 },
  compliance: { violation_count: 1, camera_offline_count: 0 },
};

describe('school-score-engine calculation', () => {
  it('computes bounded module scores from fixture inputs', () => {
    assert.ok(computeTeacherScore(fixture).score >= 0 && computeTeacherScore(fixture).score <= 100);
    assert.ok(computeOccupancyScore(fixture).score >= 0);
    assert.ok(computeAcademicScore(fixture).score >= 0);
    assert.ok(computeParentScore(fixture).score >= 0);
  });

  it('overall is weighted sum of module scores', () => {
    const modules = computeAllModuleScores(1, '2099-07-01', fixture);
    const overall = computeOverallScore(modules, DEFAULT_WEIGHTS);
    assert.ok(overall >= 0 && overall <= 100);
    assert.ok(modules.teacher.drivers.length >= 1);
  });

  it('identical inputs produce identical scores on re-run', () => {
    const a = computeTeacherScore(fixture).score;
    const b = computeTeacherScore(fixture).score;
    assert.equal(a, b);
  });
});
