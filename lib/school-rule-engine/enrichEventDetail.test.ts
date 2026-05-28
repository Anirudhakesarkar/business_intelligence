import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchool } from '../school-foundation/seed';
import { seedDemoAiSignals } from '../school-ai-signals/seed';
import { resetAiSignalsStore } from '../school-ai-signals/store';
import { enrichIntelligenceEventDetail } from './enrichEventDetail';
import { evaluateRules, listEvents, resetRuleEngineStore, seedDefaultRules } from './store';

describe('enrichIntelligenceEventDetail', () => {
  it('adds rule name and resolved labels when event has ids', () => {
    resetRuleEngineStore();
    resetAiSignalsStore();
    seedDemoSchool(1);
    seedDemoAiSignals(1);
    seedDefaultRules(1);
    evaluateRules(1);
    const ev = listEvents(1)[0];
    assert.ok(ev);
    const ctx = enrichIntelligenceEventDetail(ev);
    if (ev.ruleId) assert.equal(typeof ctx.ruleName, 'string');
    assert.ok(ctx.calendarDayType);
    assert.ok(ctx.timeWindow);
  });
});
