import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { db, resetStoreForSeed } from '../school-foundation/store';
import { seedDemoSchool } from '../school-foundation/seed';
import {
  createRule,
  deleteRule,
  getRule,
  listConditionsForRule,
  listRules,
  resetRuleEngineStore,
  updateRule,
} from './store';

describe('school-rule-engine rule CRUD', () => {
  it('creates TeacherSupervisionGap rule with duration condition', () => {
    resetRuleEngineStore();
    seedDemoSchool(1);
    const rule = createRule({
      organizationId: 1,
      name: 'Custom supervision gap',
      eventType: 'TeacherSupervisionGap',
      module: 'TeacherProductivity',
      enabled: true,
      severityDefault: 'High',
      cooldownSeconds: 600,
      version: 1,
      conditions: [{ conditionType: 'no_teacher_with_students', parameters: { minStudents: 5, minMinutes: 5 }, sortOrder: 0 }],
    });
    const conds = listConditionsForRule(rule.id);
    assert.equal(conds.length, 1);
    assert.equal(conds[0].parameters.minMinutes, 5);
  });

  it('PATCH bumps version when thresholds change', () => {
    resetRuleEngineStore();
    seedDemoSchool(1);
    const rule = createRule({
      organizationId: 1,
      name: 'Gap',
      eventType: 'TeacherSupervisionGap',
      module: 'TeacherProductivity',
      enabled: true,
      severityDefault: 'High',
      cooldownSeconds: 600,
      version: 1,
      conditions: [{ conditionType: 'no_teacher_with_students', parameters: { minMinutes: 5 }, sortOrder: 0 }],
    });
    const updated = updateRule(rule.id, {
      conditions: [{ conditionType: 'no_teacher_with_students', parameters: { minMinutes: 7 }, sortOrder: 0 }],
    });
    assert.equal(updated.version, 2);
    assert.equal(listConditionsForRule(rule.id)[0].parameters.minMinutes, 7);
  });

  it('delete soft-disables rule', () => {
    resetRuleEngineStore();
    seedDemoSchool(1);
    const rule = createRule({
      organizationId: 1,
      name: 'Temp',
      eventType: 'Loitering',
      module: 'Discipline',
      enabled: true,
      severityDefault: 'Low',
      cooldownSeconds: 300,
      version: 1,
    });
    deleteRule(rule.id);
    assert.equal(getRule(rule.id)?.enabled, false);
    assert.ok(listRules(1).some((r) => r.id === rule.id));
  });

  it('writes audit entries on rule create and update', () => {
    resetRuleEngineStore();
    seedDemoSchool(1);
    const rule = createRule({
      organizationId: 1,
      name: 'Audited',
      eventType: 'GateCongestion',
      module: 'ParentExperience',
      enabled: true,
      severityDefault: 'Medium',
      cooldownSeconds: 600,
      version: 1,
    });
    updateRule(rule.id, { cooldownSeconds: 900 });
    const audits = db.auditLog().filter((a) => a.entityType === 'intelligence_rule' && a.entityId === rule.id);
    assert.ok(audits.some((a) => a.action === 'create'));
    assert.ok(audits.some((a) => a.action === 'update'));
  });
});

describe('rule enable Phase 1 validation', () => {
  it('rejects enabled gate rule when no Gate camera exists', () => {
    resetStoreForSeed();
    resetRuleEngineStore();
    assert.throws(
      () =>
        createRule({
          organizationId: 1,
          name: 'Gate only',
          eventType: 'GateCongestion',
          module: 'ParentExperience',
          enabled: true,
          severityDefault: 'Medium',
          cooldownSeconds: 600,
          version: 1,
          conditions: [{ conditionType: 'gate_queue', parameters: { minQueue: 10 }, sortOrder: 0 }],
        }),
      /Gate camera/,
    );
  });

  it('allows enabled gate rule after seeding Phase 1', () => {
    resetRuleEngineStore();
    seedDemoSchool(1);
    const rule = createRule({
      organizationId: 1,
      name: 'Gate ok',
      eventType: 'GateCongestion',
      module: 'ParentExperience',
      enabled: true,
      severityDefault: 'Medium',
      cooldownSeconds: 600,
      version: 1,
      conditions: [{ conditionType: 'gate_queue', parameters: { minQueue: 10 }, sortOrder: 0 }],
    });
    assert.ok(rule.id);
  });
});
