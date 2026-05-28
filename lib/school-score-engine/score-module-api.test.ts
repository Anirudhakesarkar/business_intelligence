import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchool } from '../school-foundation/seed';
import { seedSchoolDailySummariesPipeline } from '../school-daily-summaries/seed';
import {
  calculateScoresForDay,
  getModuleScoreDetail,
  getModuleScoreHistory,
  resetScoreEngineStore,
} from './store';
import { dailyDb } from '../school-daily-summaries/store';

describe('school-score-engine module API shape', () => {
  it('parent module returns dispersal crowding as top driver when congested', async () => {
    resetScoreEngineStore();
    const date = '2099-08-01';
    await seedDemoSchool(1);
    await seedSchoolDailySummariesPipeline(1, date);
    const scoreInput = dailyDb.scoreInputs().find((r) => r.organizationId === 1 && r.summaryDate === date);
    if (scoreInput?.inputsJson) {
      scoreInput.inputsJson = {
        ...scoreInput.inputsJson,
        parent: { dispersal_congestion_min: 25, arrival_smooth_score: 60, overlap_count: 2, delay_min: 10 },
      };
    }
    calculateScoresForDay(1, date);
    const detail = getModuleScoreDetail(1, date, 'parent');
    assert.ok(detail.score != null && detail.score <= 85);
    assert.ok(detail.top_drivers.some((d) => /dispersal/i.test(d.label)));
    assert.ok(detail.top_drivers.some((d) => d.metricKey === 'gate_congestion'));
    assert.ok(detail.trend_delta === null || typeof detail.trend_delta === 'number');
  });

  it('module trend returns 30 daily points from score store without signal queries', async () => {
    resetScoreEngineStore();
    const endDate = '2099-08-10';
    await seedDemoSchool(1);
    for (let i = 0; i < 30; i++) {
      const d = new Date(`${endDate}T12:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() - i);
      const iso = d.toISOString().slice(0, 10);
      await seedSchoolDailySummariesPipeline(1, iso);
      calculateScoresForDay(1, iso);
    }
    const points = getModuleScoreHistory(1, 'teacher', endDate, 30);
    assert.equal(points.length, 30);
  });
});
