import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../school-foundation/store';
import { seedDemoSchool } from '../school-foundation/seed';
import { resetAiSignalsStore, ingestSignal, upsertProcessingConfig } from '../school-ai-signals/store';
import { seedDemoAiSignals } from '../school-ai-signals/seed';
import {
  evaluateRules,
  listEvents,
  resetRuleEngineStore,
  seedDefaultRules,
  isInCooldown,
  createEvent,
  listRules,
  updateRule,
} from './store';
import type { IntelligenceRule } from './types';

describe('school-rule-engine evaluation', () => {
  it('uses rule severity default on created events', () => {
    resetRuleEngineStore();
    resetAiSignalsStore();
    seedDemoSchool(1);
    seedDemoAiSignals(1);
    seedDefaultRules(1);
    evaluateRules(1);
    const ev = listEvents(1).find((e) => e.eventType === 'TeacherSupervisionGap');
    assert.ok(ev);
    const rule = listRules(1).find((r) => r.eventType === 'TeacherSupervisionGap');
    assert.ok(rule);
    assert.equal(ev.severity, rule.severityDefault);
  });

  it('creates TeacherSupervisionGap when students present without teacher', () => {
    resetRuleEngineStore();
    resetAiSignalsStore();
    seedDemoSchool(1);
    const cam = db.cameras().find((c) => c.organizationId === 1 && c.purpose === 'Classroom')!;
    upsertProcessingConfig(cam.id, { enabledSignals: ['PersonCount', 'TeacherPresent'] });
    const at = new Date().toISOString();
    ingestSignal({ cameraId: cam.id, signalType: 'PersonCount', signalValue: 12, observedAt: at });
    ingestSignal({ cameraId: cam.id, signalType: 'TeacherPresent', signalValue: 0, observedAt: at });
    seedDefaultRules(1);
    const result = evaluateRules(1);
    assert.equal(result.skipped, false);
    assert.ok(listEvents(1).some((e) => e.eventType === 'TeacherSupervisionGap'));
  });

  it('skips evaluation on configured holiday', () => {
    resetRuleEngineStore();
    resetAiSignalsStore();
    seedDemoSchool(1);
    seedDefaultRules(1);
    const today = new Date().toISOString().slice(0, 10);
    const cal = db.calendar();
    for (let i = cal.length - 1; i >= 0; i--) {
      if (cal[i].organizationId === 1 && cal[i].calendarDate === today) cal.splice(i, 1);
    }
    cal.push({ id: 77777, organizationId: 1, calendarDate: today, dayType: 'Holiday', label: 'Today off' });
    const result = evaluateRules(1);
    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'holiday');
    assert.equal(listEvents(1).length, 0);
  });

  it('replay window evaluates historical signals', () => {
    resetRuleEngineStore();
    resetAiSignalsStore();
    seedDemoSchool(1);
    const cam = db.cameras().find((c) => c.purpose === 'Gate')!;
    const t = new Date('2099-03-01T15:00:00.000Z').toISOString();
    ingestSignal({ cameraId: cam.id, signalType: 'PersonCount', signalValue: 25, observedAt: t });
    seedDefaultRules(1);
    const result = evaluateRules(1, { from: '2099-03-01T14:00:00.000Z', to: '2099-03-01T16:00:00.000Z' });
    assert.equal(result.skipped, false);
    assert.ok(result.created >= 0);
  });

  it('cooldown prevents duplicate events for same rule and camera', () => {
    resetRuleEngineStore();
    const rule: IntelligenceRule = {
      id: 1,
      organizationId: 1,
      name: 'Test',
      eventType: 'RunningDetected',
      module: 'Discipline',
      enabled: true,
      severityDefault: 'Low',
      cooldownSeconds: 3600,
      version: 1,
      createdAt: new Date().toISOString(),
    };
    const match = { cameraId: 5, roomId: 1, eventType: 'RunningDetected' as const, startedAt: new Date().toISOString() };
    createEvent({
      organizationId: 1,
      ruleId: 1,
      eventType: 'RunningDetected',
      module: 'Discipline',
      severity: 'Low',
      status: 'Open',
      cameraId: 5,
      roomId: 1,
      startedAt: match.startedAt,
      evidence: { summary: 'prior' },
    });
    assert.equal(isInCooldown(rule, match), true);
  });


  it('respects minMinutes: short gap does not fire, longer gap fires', () => {
    resetRuleEngineStore();
    resetAiSignalsStore();
    seedDemoSchool(1);
    const cam = db.cameras().find((c) => c.organizationId === 1 && c.purpose === 'Classroom')!;
    upsertProcessingConfig(cam.id, { enabledSignals: ['PersonCount', 'TeacherPresent'] });
    const base = Date.now() - 20 * 60 * 1000;
    const t0 = new Date(base).toISOString();
    const t8 = new Date(base + 8 * 60 * 1000).toISOString();
    const from = new Date(base - 60 * 1000).toISOString();
    const to = new Date(base + 15 * 60 * 1000).toISOString();
    assert.equal(ingestSignal({ cameraId: cam.id, signalType: 'PersonCount', signalValue: 12, observedAt: t0 }).stored, true);
    assert.equal(ingestSignal({ cameraId: cam.id, signalType: 'TeacherPresent', signalValue: 0, observedAt: t0 }).stored, true);
    assert.equal(ingestSignal({ cameraId: cam.id, signalType: 'PersonCount', signalValue: 12, observedAt: t8 }).stored, true);
    assert.equal(ingestSignal({ cameraId: cam.id, signalType: 'TeacherPresent', signalValue: 0, observedAt: t8 }).stored, true);
    seedDefaultRules(1);
    const supRule = listRules(1).find((r) => r.eventType === 'TeacherSupervisionGap');
    assert.ok(supRule);
    const wind = { from, to };
    updateRule(supRule.id, {
      conditions: [{ conditionType: 'no_teacher_with_students', parameters: { minStudents: 5, minMinutes: 10 }, sortOrder: 0 }],
    });
    const shortGap = evaluateRules(1, wind);
    assert.equal(shortGap.skipped, false);
    assert.ok(!shortGap.events.some((e) => e.eventType === 'TeacherSupervisionGap'));
    updateRule(supRule.id, {
      conditions: [{ conditionType: 'no_teacher_with_students', parameters: { minStudents: 5, minMinutes: 6 }, sortOrder: 0 }],
    });
    const longGap = evaluateRules(1, wind);
    assert.ok(longGap.events.some((e) => e.eventType === 'TeacherSupervisionGap'));
  });

  it('events include module tag and evidence for Phase 4', () => {
    resetRuleEngineStore();
    resetAiSignalsStore();
    seedDemoSchool(1);
    seedDemoAiSignals(1);
    seedDefaultRules(1);
    evaluateRules(1);
    const ev = listEvents(1)[0];
    assert.ok(ev.module);
    assert.ok(ev.evidence);
    assert.ok(ev.ruleId);
  });
});
