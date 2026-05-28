import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchool } from '../school-foundation/seed';
import { runDailySchoolIntelligenceJob } from '../school-jobs/run-daily';
import { getScoreDrilldown } from './drilldown';

describe('score-drilldown', () => {
  it('traces teacher module to events', () => {
    const date = new Date().toISOString().slice(0, 10);
    seedDemoSchool(1);
    runDailySchoolIntelligenceJob({ organizationId: 1, date, seedIfEmpty: false });
    const d = getScoreDrilldown(1, date, 'teacher', 'gaps');
    assert.ok(d.score);
    assert.equal(d.trace[0], 'score');
    assert.ok(Array.isArray(d.events));
  });
});
