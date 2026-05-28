import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runDailySchoolIntelligenceJob } from './run-daily';
import { seedDemoSchool } from '../school-foundation/seed';

describe('school-jobs', () => {
  it('run-daily completes pipeline', async () => {
    await seedDemoSchool(1);
    const r = await runDailySchoolIntelligenceJob({ organizationId: 1, seedIfEmpty: false });
    assert.equal(r.ok, true);
    assert.ok(r.evaluation);
    assert.ok(r.aggregation);
    assert.ok(r.scores);
    assert.ok(r.gpt);
  });
});
