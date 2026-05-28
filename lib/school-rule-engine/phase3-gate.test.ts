import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchool } from '../school-foundation/seed';
import { createCalendarDay } from '../school-foundation/store';
import { seedDemoAiSignals } from '../school-ai-signals/seed';
import { resetAiSignalsStore } from '../school-ai-signals/store';
import {
  evaluateRules,
  listEvents,
  listRules,
  resetRuleEngineStore,
  seedDefaultRules,
} from './store';

/** Task 10 — minimum demo archetypes that must appear together after seed + evaluate. */
const MINIMUM_EVENT_TYPES = [
  'TeacherSupervisionGap',
  'GateCongestion',
  'RestrictedZoneEntry',
  'FallDetected',
  'VehicleStudentOverlap',
] as const;

describe('Phase 3 gate (task 10 seed & acceptance)', () => {
  it('seeds at least five enabled rules with demo thresholds', () => {
    resetRuleEngineStore();
    seedDemoSchool(1);
    seedDefaultRules(1);
    const enabled = listRules(1).filter((r) => r.enabled);
    assert.ok(enabled.length >= 5, `expected >=5 enabled rules, got ${enabled.length}`);
  });

  it('evaluation creates sample-style events for one school day (fixture)', () => {
    resetRuleEngineStore();
    resetAiSignalsStore();
    seedDemoSchool(1);
    seedDemoAiSignals(1);
    seedDefaultRules(1);
    const result = evaluateRules(1);
    assert.equal(result.skipped, false);
    assert.ok(result.created >= 5, `expected events created, got ${result.created}`);
    const types = new Set(listEvents(1).map((e) => e.eventType));
    for (const t of MINIMUM_EVENT_TYPES) {
      assert.ok(types.has(t), `missing event type ${t}; have ${[...types].sort().join(', ')}`);
    }
  });

  it('does not create events on a configured holiday', () => {
    resetRuleEngineStore();
    resetAiSignalsStore();
    seedDemoSchool(1);
    seedDemoAiSignals(1);
    seedDefaultRules(1);
    const today = new Date().toISOString().slice(0, 10);
    createCalendarDay({ organizationId: 1, calendarDate: today, dayType: 'Holiday', label: 'Phase3 gate holiday' });
    const result = evaluateRules(1);
    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'holiday');
    assert.equal(listEvents(1).length, 0);
  });

  it('events trace to rule and camera or zone with signal ids when present', () => {
    resetRuleEngineStore();
    resetAiSignalsStore();
    seedDemoSchool(1);
    seedDemoAiSignals(1);
    seedDefaultRules(1);
    evaluateRules(1);
    const events = listEvents(1);
    assert.ok(events.length >= 5);
    for (const e of events) {
      assert.ok(e.ruleId, `event ${e.id} missing ruleId`);
      assert.ok(
        e.cameraId != null || e.zoneId != null || e.roomId != null,
        `event ${e.id} missing location ids`,
      );
      assert.ok(Array.isArray(e.evidence?.signalIds), `event ${e.id} missing evidence.signalIds array`);
    }
  });
});
