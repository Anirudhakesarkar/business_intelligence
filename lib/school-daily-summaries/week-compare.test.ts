import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchool } from '../school-foundation/seed';
import { seedRuleEngine } from '../school-rule-engine/seed';
import { seedDemoAiSignals } from '../school-ai-signals/seed';
import { resetAiSignalsStore } from '../school-ai-signals/store';
import { resetRuleEngineStore } from '../school-rule-engine/store';
import { aggregateDay, getModuleWeekCompare, resetDailySummariesStore } from './store';

function seedPipeline(orgId = 1, endDate = '2099-06-10') {
  resetDailySummariesStore();
  resetAiSignalsStore();
  resetRuleEngineStore();
  seedDemoSchool(orgId);
  seedDemoAiSignals(orgId);
  seedRuleEngine(orgId);
  const end = new Date(`${endDate}T12:00:00.000Z`);
  for (let i = 0; i < 14; i++) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    aggregateDay(orgId, d.toISOString().slice(0, 10));
  }
}

describe('school-daily-summaries week compare', () => {
  it('compare returns this week vs last week for process dispersal metric', () => {
    const date = '2099-06-10';
    seedPipeline(1, date);
    const cmp = getModuleWeekCompare('process', 1, date, undefined, 'dispersal_congestion_min');
    assert.equal(cmp.module, 'process');
    assert.equal(cmp.metricKey, 'dispersal_congestion_min');
    assert.equal(cmp.thisWeek.points.length, 7);
    assert.equal(cmp.lastWeek.points.length, 7);
    assert.equal(typeof cmp.delta, 'number');
  });

  it('gate-flow metric aligns process_daily dispersal on selected day', () => {
    const date = '2099-06-10';
    seedPipeline(1, date);
    const cmp = getModuleWeekCompare('process', 1, date, undefined, 'dispersal_congestion_min');
    const today = cmp.thisWeek.points.find((p) => p.date === date);
    assert.ok(today);
    assert.equal(typeof today!.value, 'number');
    assert.equal(cmp.thisWeek.total >= today!.value!, true);
  });
});
