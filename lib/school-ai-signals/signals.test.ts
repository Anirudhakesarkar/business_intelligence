import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../school-foundation/store';
import { seedDemoSchool } from '../school-foundation/seed';
import {
  resetAiSignalsStore,
  ingestSignal,
  ensureRetentionPolicy,
  runRetentionJob,
  runFreshnessHealthJob,
  reportStreamTimeout,
  getCameraFreshness,
  getLatestSignals,
  getSignalTimeline,
  listSignals,
  aiDb,
} from './store';
import { seedDemoAiSignals } from './seed';

describe('school-ai-signals', () => {
  it('ingests signal with valid camera', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    const cam = db.cameras().find((c) => c.organizationId === 1);
    assert.ok(cam);
    const r = ingestSignal({
      cameraId: cam!.id,
      signalType: 'PersonCount',
      signalValue: 12,
      confidence: 0.9,
      observedAt: new Date().toISOString(),
    });
    assert.equal(r.stored, true);
  });

  it('retention job runs', () => {
    ensureRetentionPolicy(1);
    const result = runRetentionJob(1);
    assert.ok('removedSignals' in result);
  });

  it('demo seed produces many signals', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    const s = seedDemoAiSignals(1);
    assert.ok(s.signals >= 500);
  });

  it('S1 rejects missing camera', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    const r = ingestSignal({
      cameraId: 999999,
      signalType: 'PersonCount',
      signalValue: 1,
      observedAt: new Date().toISOString(),
    });
    assert.equal(r.stored, false);
    assert.equal(r.reason, 'camera_not_found');
  });

  it('S2 rejects inactive camera', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    const cam = db.cameras().find((c) => c.organizationId === 1)!;
    cam.status = 'Inactive';
    const r = ingestSignal({
      cameraId: cam.id,
      signalType: 'PersonCount',
      signalValue: 1,
      observedAt: new Date().toISOString(),
    });
    assert.equal(r.stored, false);
    assert.equal(r.reason, 'camera_inactive');
  });

  it('S3 ignores below min confidence', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    const cam = db.cameras().find((c) => c.organizationId === 1)!;
    const r = ingestSignal({
      cameraId: cam.id,
      signalType: 'PersonCount',
      signalValue: 1,
      confidence: 0.01,
      observedAt: new Date().toISOString(),
    });
    assert.equal(r.stored, false);
    assert.equal(r.reason, 'below_min_confidence');
  });

  it('S4 rejects future timestamp', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    const cam = db.cameras().find((c) => c.organizationId === 1)!;
    const future = new Date(Date.now() + 48 * 3600000).toISOString();
    const r = ingestSignal({
      cameraId: cam.id,
      signalType: 'PersonCount',
      signalValue: 1,
      observedAt: future,
    });
    assert.equal(r.stored, false);
    assert.equal(r.reason, 'future_timestamp');
  });

  it('S5 dedupes same camera/time/type', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    const cam = db.cameras().find((c) => c.organizationId === 1)!;
    const at = new Date().toISOString();
    assert.equal(ingestSignal({ cameraId: cam.id, signalType: 'PersonCount', signalValue: 1, observedAt: at }).stored, true);
    assert.equal(ingestSignal({ cameraId: cam.id, signalType: 'PersonCount', signalValue: 2, observedAt: at }).stored, false);
  });

  it('S6 freshness job marks stale cameras after 10 min gap', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    const cam = db.cameras().find((c) => c.organizationId === 1)!;
    const old = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    ingestSignal({ cameraId: cam.id, signalType: 'PersonCount', signalValue: 1, observedAt: old });
    const result = runFreshnessHealthJob(1);
    assert.ok(result.staleCameras.includes(cam.id));
    const fresh = getCameraFreshness(cam.id);
    assert.equal(fresh.stale, true);
  });

  it('S7 stream timeout records offline health event', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    const cam = db.cameras().find((c) => c.organizationId === 1)!;
    reportStreamTimeout(cam.id);
    const events = aiDb.healthEvents().filter((e) => e.cameraId === cam.id && e.healthStatus === 'Offline');
    assert.ok(events.length >= 1);
  });

  it('S8 tamper signal records tampered health event', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    const cam = db.cameras().find((c) => c.organizationId === 1 && c.purpose === 'Compliance')!;
    assert.ok(cam);
    ingestSignal({ cameraId: cam.id, signalType: 'Tamper', signalValue: 1, observedAt: new Date().toISOString() });
    const events = aiDb.healthEvents().filter((e) => e.cameraId === cam.id && e.healthStatus === 'Tampered');
    assert.ok(events.length >= 1);
  });

  it('latest returns null per type when no signals', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    const cam = db.cameras().find((c) => c.organizationId === 1)!;
    const latest = getLatestSignals(cam.id, ['PersonCount']);
    assert.equal(latest.PersonCount, null);
  });

  it('timeline ordered ASC and respects limit', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    const cam = db.cameras().find((c) => c.organizationId === 1)!;
    const base = Date.now();
    for (let i = 0; i < 5; i++) {
      ingestSignal({
        cameraId: cam.id,
        signalType: 'PersonCount',
        signalValue: i,
        observedAt: new Date(base + i * 1000).toISOString(),
      });
    }
    const from = new Date(base - 1000).toISOString();
    const to = new Date(base + 10000).toISOString();
    const timeline = getSignalTimeline(cam.id, from, to, 3);
    assert.equal(timeline.length, 3);
    assert.ok(timeline[0].observedAt <= timeline[1].observedAt);
  });

  it('listSignals rejects cross-org camera filter', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    const cam1 = db.cameras().find((c) => c.organizationId === 1)!;
    ingestSignal({ cameraId: cam1.id, signalType: 'PersonCount', signalValue: 1, observedAt: new Date().toISOString() });
    const cross = listSignals({ organizationId: 999, cameraId: cam1.id });
    assert.equal(cross.length, 0);
    const org1 = listSignals({ organizationId: 1, cameraId: cam1.id });
    assert.equal(org1.length, 1);
  });
});
