import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createEvent, listEvents, resetRuleEngineStore } from './store';

describe('school-rule-engine listEvents', () => {
  it('filters by zoneId', () => {
    resetRuleEngineStore();
    createEvent({
      organizationId: 1,
      eventType: 'GateCongestion',
      module: 'ParentExperience',
      severity: 'High',
      status: 'Open',
      zoneId: 42,
      startedAt: '2099-01-01T10:00:00.000Z',
      evidence: { summary: 'gate a' },
    });
    createEvent({
      organizationId: 1,
      eventType: 'GateCongestion',
      module: 'ParentExperience',
      severity: 'High',
      status: 'Open',
      zoneId: 99,
      startedAt: '2099-01-01T11:00:00.000Z',
      evidence: { summary: 'gate b' },
    });
    const rows = listEvents(1, { zoneId: 42 });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].zoneId, 42);
  });
});
