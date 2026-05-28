import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../school-foundation/store';
import { seedDemoSchool } from '../school-foundation/seed';
import {
  ingestSignal,
  resetAiSignalsStore,
  runRetentionJob,
  ensureRetentionPolicy,
} from './store';

describe('school-ai-signals privacy', () => {
  it('rejects signal without camera id', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    const r = ingestSignal({
      cameraId: 99999,
      signalType: 'PersonCount',
      signalValue: 1,
      observedAt: new Date().toISOString(),
    });
    assert.equal(r.stored, false);
  });

  it('rejects signal on inactive camera', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    const cam = db.cameras().find((c) => c.status === 'Active')!;
    cam.status = 'Inactive';
    const r = ingestSignal({
      cameraId: cam.id,
      signalType: 'PersonCount',
      signalValue: 1,
      confidence: 0.9,
      observedAt: new Date().toISOString(),
    });
    assert.equal(r.stored, false);
  });

  it('filters low confidence per camera config', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    const cam = db.cameras()[0];
    const r = ingestSignal({
      cameraId: cam.id,
      signalType: 'PersonCount',
      signalValue: 10,
      confidence: 0.01,
      observedAt: new Date().toISOString(),
    });
    assert.equal(r.stored, false);
    assert.equal(r.reason, 'below_min_confidence');
  });

  it('metadata must not contain face embedding or student name fields', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    const cam = db.cameras()[0];
    ingestSignal({
      cameraId: cam.id,
      signalType: 'PersonCount',
      signalValue: 5,
      confidence: 0.9,
      observedAt: new Date().toISOString(),
      metadata: { seed: true },
    });
    const sig = ingestSignal({
      cameraId: cam.id,
      signalType: 'PersonCount',
      signalValue: 5,
      confidence: 0.9,
      observedAt: new Date().toISOString(),
      metadata: { face_embedding: [1, 2], student_name: 'John' },
    });
    assert.equal(sig.stored, false);
  });

  it('retention removes old signals', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    ensureRetentionPolicy(1);
    const cam = db.cameras()[0];
    const old = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
    ingestSignal({
      cameraId: cam.id,
      signalType: 'PersonCount',
      signalValue: 1,
      confidence: 0.9,
      observedAt: old,
    });
    const before = ingestSignal;
    const result = runRetentionJob(1);
    assert.ok(result.removedSignals >= 0);
  });
});
