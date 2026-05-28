import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchool } from '../school-foundation/seed';
import { seedSchoolDailySummariesPipeline } from '../school-daily-summaries/seed';
import { calculateScoresForDay, getActiveWeightProfile } from './store';

describe('school-score-engine', () => {
  it('calculates overall score with docx weights', () => {
    const date = new Date().toISOString().slice(0, 10);
    seedDemoSchool(1);
    seedSchoolDailySummariesPipeline(1, date);
    const profile = getActiveWeightProfile(1, date);
    assert.ok(profile.weights.safety >= 0.15);
    const result = calculateScoresForDay(1, date);
    assert.ok(result.overall.overallScore >= 0 && result.overall.overallScore <= 100);
  });
});
