import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchool } from '../school-foundation/seed';
import { seedRuleEngine } from '../school-rule-engine/seed';
import { seedDemoAiSignals } from '../school-ai-signals/seed';
import { resetAiSignalsStore } from '../school-ai-signals/store';
import { resetRuleEngineStore } from '../school-rule-engine/store';
import {
  aggregateDay,
  getDailyOverview,
  getModuleDailySummary,
  getModuleMetricEvents,
  getModuleDailyTrend,
  resetDailySummariesStore,
} from './store';

function seedPipeline(orgId = 1, date = '2099-06-10') {
  resetDailySummariesStore();
  resetAiSignalsStore();
  resetRuleEngineStore();
  seedDemoSchool(orgId);
  seedDemoAiSignals(orgId);
  seedRuleEngine(orgId);
  return aggregateDay(orgId, date);
}

describe('school-daily-summaries query APIs', () => {
  it('overview returns nine module slices for seeded date', () => {
    const date = '2099-06-10';
    seedPipeline(1, date);
    const overview = getDailyOverview(1, date);
    assert.equal(overview.modules.length, 9);
    assert.ok(overview.scoreInputs?.inputsJson);
    const modules = new Set(overview.modules.map((m) => m.module));
    for (const m of ['teacher', 'classroom', 'occupancy', 'process', 'staff', 'space', 'discipline', 'parent', 'compliance']) {
      assert.ok(modules.has(m as typeof overview.modules[0]['module']), m);
    }
  });

  it('module summary returns facts and headline metrics without ai_signals', () => {
    const date = '2099-06-11';
    seedPipeline(1, date);
    const teacher = getModuleDailySummary('teacher', 1, date);
    assert.equal(teacher.module, 'teacher');
    assert.ok(teacher.facts.length >= 1);
    assert.ok('conducted_pct' in teacher.headlineMetrics);
    assert.ok(!('ai_signals' in (teacher as Record<string, unknown>)));
  });

  it('drilldown returns supervision gap events for teacher metric', () => {
    const date = '2099-06-12';
    seedPipeline(1, date);
    const drill = getModuleMetricEvents('teacher', 1, date, 'supervision_gaps');
    assert.equal(drill.metric, 'supervision_gaps');
    for (const e of drill.events) {
      assert.equal(e.eventType, 'TeacherSupervisionGap');
    }
  });

  it('trend returns summary-only daily points', () => {
    const date = '2099-06-13';
    seedPipeline(1, date);
    aggregateDay(1, '2099-06-12');
    const trend = getModuleDailyTrend('teacher', 1, date, 2);
    assert.equal(trend.points.length, 2);
    assert.ok(trend.points.every((p) => p.date && 'value' in p));
  });
});
