import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchool } from '../school-foundation/seed';
import { seedRuleEngine } from '../school-rule-engine/seed';
import { seedDemoAiSignals } from '../school-ai-signals/seed';
import { resetAiSignalsStore } from '../school-ai-signals/store';
import { resetRuleEngineStore } from '../school-rule-engine/store';
import { aggregateDay, dailyDb, resetDailySummariesStore } from './store';

describe('school-daily-summaries MVP3 facts', () => {
  it('exposes score-ready metrics for Phase 5', () => {
    resetDailySummariesStore();
    resetAiSignalsStore();
    resetRuleEngineStore();
    seedDemoSchool(1);
    seedDemoAiSignals(1);
    seedRuleEngine(1);
    const date = '2099-06-20';
    aggregateDay(1, date);

    const teacher = dailyDb.teacher().find((r) => r.summaryDate === date)!;
    assert.ok(teacher.metrics.conducted_pct != null);
    assert.ok(teacher.metrics.presence_pct != null);
    assert.ok(teacher.metrics.on_time_pct != null);
    assert.ok(teacher.metrics.teaching_zone_activity != null);
    assert.ok('gap_count' in teacher.metrics);
    assert.ok('early_exit_count' in teacher.metrics);

    const occ = dailyDb.occupancy().find((r) => r.summaryDate === date)!;
    assert.ok('expected_match' in occ.metrics || 'expected_match_pct' in occ.metrics);
    assert.ok('overcrowding_count' in occ.metrics);
    assert.ok('underuse_count' in occ.metrics);
    assert.ok('empty_room_count' in occ.metrics);

    const classroom = dailyDb.classroom().find((r) => r.summaryDate === date)!;
    assert.ok('conducted_pct' in classroom.metrics);
    assert.ok('late_count' in classroom.metrics);
    assert.ok('missed_count' in classroom.metrics);

    const parent = dailyDb.parent().find((r) => r.summaryDate === date)!;
    assert.ok('dispersal_congestion_min' in parent.metrics);
    assert.ok('overlap_count' in parent.metrics);
    assert.ok('delay_min' in parent.metrics);

    const process = dailyDb.process().find((r) => r.summaryDate === date && r.timeWindow === 'Dispersal')!;
    assert.ok(process.metrics.dispersal_congestion_min != null);
    assert.ok('overlap_count' in process.metrics);

    const score = dailyDb.scoreInputs().find((r) => r.summaryDate === date)!;
    const j = score.inputsJson;
    assert.ok(j.teacher);
    assert.ok(j.classroom);
    assert.ok(j.occupancy);
    assert.ok(j.parent);
    assert.ok(j.process);
    assert.equal(j.safety?.placeholder, true);
    assert.equal(j.security?.placeholder, true);
  });
});
