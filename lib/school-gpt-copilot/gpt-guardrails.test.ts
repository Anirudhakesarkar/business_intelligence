import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkRateLimit,
  insufficientDataInstruction,
  resetGptGuardrailsForTests,
  shrinkContextJson,
  truncateContext,
  validateResponseCitations,
} from './guardrails';
import type { SchoolGptContext } from './types';
import { buildCopilotPrompt } from './context-builder';

function sampleCtx(): SchoolGptContext {
  return {
    contract_version: 'school-gpt-v1',
    date: '2099-01-01',
    org_id: 1,
    timezone: 'Asia/Kolkata',
    overall_score: 72,
    module_scores: Array.from({ length: 10 }, (_, i) => ({
      key: `mod${i}`,
      label: `Module ${i}`,
      score: 50 + i,
      weight: 0.1,
      drivers: i === 0 ? [] : [{ key: 'd', label: 'Driver', impact: -1 }],
    })),
    summary_facts: Array.from({ length: 30 }, (_, i) => ({ module: 'teacher', text: `Fact ${i}` })),
    top_events: Array.from({ length: 12 }, (_, i) => ({
      eventType: 'GateCongestion',
      severity: 'Medium',
      summary: `Event ${i}`,
    })),
  };
}

describe('school-gpt-copilot guardrails', () => {
  beforeEach(() => resetGptGuardrailsForTests());

  it('truncates context prioritizing worst modules', () => {
    const out = truncateContext(sampleCtx());
    assert.ok(out.module_scores.length <= 8);
    assert.ok(out.summary_facts.length <= 20);
    assert.equal(out.module_scores[0].key, 'mod0');
  });

  it('shrinkContextJson stays under character budget', () => {
    assert.ok(shrinkContextJson(sampleCtx()).length <= 12_000);
  });

  it('validateResponseCitations flags unknown module keys', () => {
    const ctx = sampleCtx();
    const bad = validateResponseCitations('Issues in [parent] and [fake_module].', ctx);
    assert.equal(bad.ok, false);
    assert.ok(bad.unknown.includes('fake_module'));
  });

  it('rate limits per organization', () => {
    for (let i = 0; i < 5; i++) assert.equal(checkRateLimit(99, 5).ok, true);
    assert.equal(checkRateLimit(99, 5).ok, false);
  });

  it('buildCopilotPrompt instructs insufficient data when drivers empty', () => {
    const ctx: SchoolGptContext = {
      contract_version: 'school-gpt-v1',
      date: '2099-01-01',
      org_id: 1,
      timezone: 'UTC',
      overall_score: 80,
      module_scores: [{ key: 'teacher', label: 'Teacher', score: 80, weight: 0.2, drivers: [] }],
      summary_facts: [],
      top_events: [],
    };
    const prompt = buildCopilotPrompt(ctx);
    assert.match(prompt, /insufficient/i);
  });

  it('insufficientDataInstruction when drivers empty', () => {
    assert.match(insufficientDataInstruction(sampleCtx()), /insufficient/i);
  });
});
