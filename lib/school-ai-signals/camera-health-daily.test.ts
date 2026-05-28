import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../school-foundation/store';
import { seedDemoSchool } from '../school-foundation/seed';
import { seedDemoAiSignals } from './seed';
import { getCameraHealthDailyScore, recordHealthEvent, resetAiSignalsStore } from './store';

describe('camera health daily score', () => {
  it('lowers score when critical camera has offline health events', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    seedDemoAiSignals(1);
    const date = new Date().toISOString().slice(0, 10);
    const target = db.cameras().find((c) => c.organizationId === 1 && c.criticality === 'Critical');
    assert.ok(target, 'need critical camera from seed');
    const at = `${date}T14:00:00.000Z`;
    for (let i = 0; i < 4; i++) recordHealthEvent(target!.id, 'Offline', at);
    const row = getCameraHealthDailyScore(1, date);
    assert.ok(row.score < 100);
    assert.ok(row.offlineMinutes > 0);
    assert.ok(row.cameras.some((c) => c.cameraId === target!.id));
  });

  it('exposes daily score API shape', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    seedDemoAiSignals(1);
    const date = new Date().toISOString().slice(0, 10);
    const row = getCameraHealthDailyScore(1, date);
    assert.equal(typeof row.score, 'number');
    assert.equal(typeof row.criticalCamerasTotal, 'number');
    assert.ok(Array.isArray(row.cameras));
  });
});
