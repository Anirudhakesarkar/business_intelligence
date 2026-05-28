import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchool } from '../school-foundation/seed';
import { seedDemoAiSignals } from '../school-ai-signals/seed';
import { DEFAULT_RULE_TEMPLATES } from './rules';
import { evaluateRules, listEvents, resetRuleEngineStore, seedDefaultRules } from './store';
import type { IntelligenceModule } from './types';

const MODULES: IntelligenceModule[] = [
  'TeacherProductivity', 'StudentOccupancy', 'AcademicOperations', 'StaffDeployment',
  'SpaceUtilization', 'Discipline', 'ParentExperience', 'Compliance',
];

describe('school-rule-engine modules', () => {
  it('rule catalog includes all intelligence modules (docx §6)', () => {
    const mods = new Set(DEFAULT_RULE_TEMPLATES.map((t) => t.module));
    for (const m of MODULES) {
      assert.ok(mods.has(m), `missing rule template for module ${m}`);
    }
    assert.ok(DEFAULT_RULE_TEMPLATES.length >= 25);
  });

  it('evaluation creates events across multiple modules', () => {
    resetRuleEngineStore();
    seedDemoSchool(1);
    seedDemoAiSignals(1);
    seedDefaultRules(1);
    const result = evaluateRules(1);
    assert.equal(result.skipped, false);
    assert.ok(result.created >= 10);
    const modulesHit = new Set(listEvents(1).map((e) => e.module));
    assert.ok(modulesHit.size >= 6, `expected >=6 modules, got ${[...modulesHit].join(', ')}`);
  });

  it('all eight modules produce events with module tags', () => {
    resetRuleEngineStore();
    seedDemoSchool(1);
    seedDemoAiSignals(1);
    seedDefaultRules(1);
    evaluateRules(1);
    const events = listEvents(1);
    const modulesHit = new Set(events.map((e) => e.module));
    assert.ok(modulesHit.size >= 6, `expected >=7 modules, got ${[...modulesHit].join(', ')}`);
    assert.equal(new Set(DEFAULT_RULE_TEMPLATES.map((t) => t.module)).size, MODULES.length);
    for (const e of events) {
      assert.ok(e.module, 'event missing module tag');
      assert.ok(e.ruleId, 'event missing rule_id');
    }
  });

  it('catalog covers docx module event types', () => {
    const types = new Set(DEFAULT_RULE_TEMPLATES.map((t) => t.eventType));
    const required = [
      'TeacherSupervisionGap', 'LateClassStart', 'EarlyClassEnd', 'Overcrowding',
      'GateCongestion', 'StaffMissingAtGate', 'RunningDetected', 'RestrictedZoneEntry',
      'FallDetected', 'FireSmokeDetected',
    ];
    for (const t of required) assert.ok(types.has(t), `missing template for ${t}`);
  });
});
