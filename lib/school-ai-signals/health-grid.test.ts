import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchool } from '../school-foundation/seed';
import { seedDemoAiSignals } from './seed';
import {
  getCameraHealthGrid,
  getCameraHealthKpis,
  resolveCameraHealthStatus,
  resetAiSignalsStore,
} from './store';

describe('school-ai-signals health grid', () => {
  it('returns KPIs and grid after seed', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    seedDemoAiSignals(1);
    const grid = getCameraHealthGrid(1);
    const kpis = getCameraHealthKpis(1);
    assert.ok(grid.length > 0);
    assert.equal(kpis.totalActive, grid.length);
    assert.ok(kpis.onlinePercent >= 0);
    assert.ok(typeof kpis.staleCount === 'number');
  });

  it('resolveCameraHealthStatus marks stale as Offline', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    seedDemoAiSignals(1);
    const row = getCameraHealthGrid(1)[0];
    const staleRow = { ...row, freshness: { ...row.freshness, stale: true } };
    assert.equal(resolveCameraHealthStatus(staleRow), 'Offline');
  });

  it('critical offline KPI counts high/critical non-online cameras', () => {
    resetAiSignalsStore();
    seedDemoSchool(1);
    seedDemoAiSignals(1);
    const grid = getCameraHealthGrid(1);
    for (const row of grid) {
      if (row.camera.criticality === 'Critical' || row.camera.criticality === 'High') {
        row.freshness.stale = true;
      }
    }
    const kpis = getCameraHealthKpis(1);
    assert.ok(kpis.criticalOffline >= 1);
  });
});
