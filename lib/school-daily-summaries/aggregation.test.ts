import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchool } from '../school-foundation/seed';
import { db } from '../school-foundation/store';
import { seedRuleEngine } from '../school-rule-engine/seed';
import { aggregateDay, backfillAggregation, resetDailySummariesStore, runScheduledAggregation, dailyDb } from './store';

describe('school-daily-summaries aggregation', () => {
  it('re-running job for same date is idempotent', () => {
    resetDailySummariesStore();
    seedDemoSchool(1);
    seedRuleEngine(1);
    const date = '2099-06-01';
    const a = aggregateDay(1, date);
    const scoreAfterFirst = dailyDb.scoreInputs().find((r) => r.summaryDate === date);
    assert.ok(scoreAfterFirst);
    const inputsJsonFirst = scoreAfterFirst.inputsJson;
    const b = aggregateDay(1, date);
    assert.equal(a.skipped, false);
    assert.equal(b.skipped, false);
    if ('tables' in a && 'tables' in b) {
      assert.deepEqual(a.tables, b.tables);
    }
    const scoreAfterSecond = dailyDb.scoreInputs().find((r) => r.summaryDate === date);
    assert.ok(scoreAfterSecond);
    assert.deepEqual(scoreAfterSecond.inputsJson, inputsJsonFirst);
  });

  it('skips holidays per school calendar', () => {
    resetDailySummariesStore();
    seedDemoSchool(1);
    const date = '2099-12-26';
    db.calendar().push({ id: 88888, organizationId: 1, calendarDate: date, dayType: 'Holiday', label: 'Winter break' });
    const r = aggregateDay(1, date);
    assert.equal(r.skipped, true);
    assert.equal(r.reason, 'holiday');
  });

  it('scheduled aggregation returns logging metadata', () => {
    resetDailySummariesStore();
    seedDemoSchool(1);
    seedRuleEngine(1);
    const { log, aggregation } = runScheduledAggregation(1, '2099-06-02');
    assert.ok(log.durationMs >= 0);
    assert.equal(aggregation.skipped, false);
  });

  it('backfill processes multiple dates', () => {
    resetDailySummariesStore();
    seedDemoSchool(1);
    seedRuleEngine(1);
    const out = backfillAggregation(1, ['2099-06-03', '2099-06-04']);
    assert.equal(out.dates.length, 2);
    assert.ok(dailyDb.teacher().length >= 1);
  });
});
