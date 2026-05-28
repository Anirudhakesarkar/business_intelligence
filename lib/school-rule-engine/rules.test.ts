import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resetRuleEngineStore, listEvents } from './store';
import { seedRuleEngine } from './seed';
import { seedDemoSchool } from '../school-foundation/seed';

describe('school-rule-engine', () => {
  it('evaluation creates events from signals', () => {
    resetRuleEngineStore();
    seedDemoSchool(1);
    const result = seedRuleEngine(1);
    assert.ok((result.evaluation?.created ?? 0) > 0);
    assert.ok(listEvents(1).length > 0);
  });
});
