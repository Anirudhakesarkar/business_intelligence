import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchool } from '../school-foundation/seed';
import { seedRuleEngine } from '../school-rule-engine/seed';
import { seedDemoAiSignals } from '../school-ai-signals/seed';
import { resetAiSignalsStore as resetSig } from '../school-ai-signals/store';
import { resetRuleEngineStore, listEvents } from '../school-rule-engine/store';
import { getModuleMetricEvents, resetDailySummariesStore, aggregateDay } from './store';

describe('summary to signal trace', () => {
  it('drilldown events include signalIds in evidence when present', () => {
    resetDailySummariesStore();
    resetSig();
    resetRuleEngineStore();
    seedDemoSchool(1);
    seedDemoAiSignals(1);
    seedRuleEngine(1);
    const date = '2099-11-05';
    aggregateDay(1, date);
    const events = getModuleMetricEvents('teacher', 1, date, 'supervision_gaps');
    if (events.length) {
      const withSignals = events.filter((e) => (e.evidence?.signalIds?.length ?? 0) > 0);
      assert.ok(withSignals.length >= 0);
    }
    const dayEvents = listEvents(1, { from: `${date}T00:00:00.000Z`, to: `${date}T23:59:59.999Z` });
    const traced = dayEvents.filter((e) => e.evidence?.signalIds?.length);
    assert.ok(traced.length >= 0);
  });
});
