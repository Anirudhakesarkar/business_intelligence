import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchool } from '../school-foundation/seed';
import { seedSchoolDailySummariesPipeline } from '../school-daily-summaries/seed';
import { createEvent } from '../school-rule-engine/store';
import { computeOverallScore, computeSafetyScore, computeSecurityScore } from './calculate';
import { calculateScoresForDay, getActiveWeightProfile } from './store';
import { DEFAULT_WEIGHTS } from './weights';
import { SCORE_DEFINITIONS } from './definitions';

describe('school-score-engine safety-security', () => {
  const date = '2099-06-01';

  it('documents safety and security formulas', () => {
    const safety = SCORE_DEFINITIONS.find((d) => d.moduleKey === 'safety');
    const security = SCORE_DEFINITIONS.find((d) => d.moduleKey === 'security');
    assert.ok(safety?.description.includes('Fall'));
    assert.ok(security?.description.includes('RestrictedZoneEntry'));
  });

  it('computes safety score from fall and fire events', () => {
    seedDemoSchool(1);
    createEvent({
      organizationId: 1,
      eventType: 'FallDetected',
      module: 'Compliance',
      severity: 'Critical',
      status: 'Open',
      startedAt: `${date}T10:00:00.000Z`,
      evidence: { summary: 'Fall detected' },
    });
    const { score } = computeSafetyScore(1, date, {});
    assert.equal(score, 75);
  });

  it('computes security score from restricted zone entries', () => {
    seedDemoSchool(1);
    createEvent({
      organizationId: 1,
      eventType: 'RestrictedZoneEntry',
      module: 'Compliance',
      severity: 'High',
      status: 'Open',
      startedAt: `${date}T11:00:00.000Z`,
      evidence: { summary: 'Unauthorized entry' },
    });
    const { score } = computeSecurityScore(1, date);
    assert.equal(score, 82);
  });

  it('overall score includes safety and security with docx weights', () => {
    seedDemoSchool(1);
    seedSchoolDailySummariesPipeline(1, date);
    const profile = getActiveWeightProfile(1, date);
    assert.equal(profile.weights.safety, DEFAULT_WEIGHTS.safety);
    assert.equal(profile.weights.security, DEFAULT_WEIGHTS.security);
    const result = calculateScoresForDay(1, date);
    assert.ok(result.overall);
    const modules = Object.fromEntries(
      (result.modules ?? []).map((m) => [m.moduleKey, m.score])
    ) as Record<string, number>;
    const manual = computeOverallScore(
      {
        safety: { score: modules.safety },
        security: { score: modules.security },
        teacher: { score: modules.teacher },
        occupancy: { score: modules.occupancy },
        academic: { score: modules.academic },
        staff: { score: modules.staff },
        space: { score: modules.space },
        discipline: { score: modules.discipline },
        parent: { score: modules.parent },
        compliance: { score: modules.compliance },
      },
      profile.weights
    );
    assert.equal(result.overall!.overallScore, manual);
  });
});
