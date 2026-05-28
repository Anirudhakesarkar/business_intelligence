import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchool } from '../school-foundation/seed';
import { seedDemoAiSignals } from '../school-ai-signals/seed';
import { resetAiSignalsStore } from '../school-ai-signals/store';

import {
  acknowledgeEvent,
  assignEvent,
  evaluateRules,
  getEvent,
  listAcknowledgements,
  listEvents,
  listNotifications,
  resetRuleEngineStore,
  resolveEvent,
  seedDefaultRules,
} from './store';

describe('school-rule-engine event lifecycle', () => {
  it('list returns open GateCongestion during seeded dispersal scenario', () => {
    resetRuleEngineStore();
    resetAiSignalsStore();
    seedDemoSchool(1);
    seedDemoAiSignals(1);
    seedDefaultRules(1);
    evaluateRules(1);
    const openGate = listEvents(1, { eventType: 'GateCongestion', status: 'Open' });
    assert.ok(openGate.length >= 1, 'expected at least one open GateCongestion from demo seed');
    assert.ok(openGate.every((e) => e.status === 'Open'));
  });

  it('listEvents filters by TeacherSupervisionGap only', () => {
    resetRuleEngineStore();
    resetAiSignalsStore();
    seedDemoSchool(1);
    seedDemoAiSignals(1);
    seedDefaultRules(1);
    evaluateRules(1);
    const only = listEvents(1, { eventType: 'TeacherSupervisionGap' });
    assert.ok(only.length >= 1, 'demo seed should produce TeacherSupervisionGap');
    assert.ok(only.every((e) => e.eventType === 'TeacherSupervisionGap'));
  });


  it('TeacherSupervisionGap evidence summarizes students without teacher', () => {
    resetRuleEngineStore();
    resetAiSignalsStore();
    seedDemoSchool(1);
    seedDemoAiSignals(1);
    seedDefaultRules(1);
    evaluateRules(1);
    const ev = listEvents(1).find((e) => e.eventType === 'TeacherSupervisionGap');
    assert.ok(ev);
    assert.match(ev.evidence.summary, /without teacher|Students present/i);
  });

  it('resolved events are excluded from unread notification list', () => {
    resetRuleEngineStore();
    resetAiSignalsStore();
    seedDemoSchool(1);
    seedDemoAiSignals(1);
    seedDefaultRules(1);
    evaluateRules(1);
    const ev = listEvents(1).find((e) => e.eventType === 'GateCongestion');
    assert.ok(ev);
    assert.equal(ev.status, 'Open');
    const unreadBefore = listNotifications(1, true);
    assert.ok(unreadBefore.some((n) => n.eventId === ev.id));
    resolveEvent(ev.id, 1, 'cleared');
    assert.equal(getEvent(ev.id)?.status, 'Resolved');
    const unreadAfter = listNotifications(1, true);
    assert.ok(!unreadAfter.some((n) => n.eventId === ev.id));
  });

  it('resolve closes event and records acknowledgement trail', () => {
    resetRuleEngineStore();
    resetAiSignalsStore();
    seedDemoSchool(1);
    seedDemoAiSignals(1);
    seedDefaultRules(1);
    evaluateRules(1);
    const ev = listEvents(1)[0];
    assert.ok(ev);
    acknowledgeEvent(ev.id, 1, 'seen');
    assignEvent(ev.id, 'coordinator@school.edu', 1);
    const resolved = resolveEvent(ev.id, 1, 'cleared queue');
    assert.equal(resolved.status, 'Resolved');
    assert.ok(resolved.resolvedAt);
    const trail = listAcknowledgements(ev.id);
    assert.ok(trail.length >= 3);
    assert.equal(getEvent(ev.id)?.status, 'Resolved');
  });

  it('event detail includes rule, camera, and evidence trace', () => {
    resetRuleEngineStore();
    resetAiSignalsStore();
    seedDemoSchool(1);
    seedDemoAiSignals(1);
    seedDefaultRules(1);
    evaluateRules(1);
    const ev = listEvents(1)[0];
    assert.ok(ev.ruleId);
    assert.ok(ev.evidence?.summary || ev.evidence?.signalIds);
    assert.ok(ev.module);
  });
});
