import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchool } from './seed';
import { applyPgMetricsToSetupHealth } from './setup-health-core';
import { countSetupHealthMetricsFromPg, getSetupHealthWithPgMetrics } from './setup-health-pg';
import { db, getSetupHealth, resetStoreForSeed } from './store';

describe('setup-health-pg', () => {
  it('getSetupHealthWithPgMetrics falls back when DB disabled', async () => {
    resetStoreForSeed();
    await seedDemoSchool(1);
    const mem = getSetupHealth(1);
    const merged = await getSetupHealthWithPgMetrics(1);
    assert.equal(merged.timetableEntries, mem.timetableEntries);
  });

  it('countSetupHealthMetricsFromPg returns null without DB', async () => {
    const r = await countSetupHealthMetricsFromPg(1);
    assert.equal(r, null);
  });

  it('applyPgMetricsToSetupHealth aligns percent and nextAction with PG counts', () => {
    const health = getSetupHealth(1);
    const pg = {
      activeCameras: 0,
      mappedActiveCameras: 0,
      orgRooms: 5,
      roomsWithCapacity: 5,
      activeTimetable: 10,
      activeRosters: 3,
      calendarDays: 40,
    };
    const merged = applyPgMetricsToSetupHealth(health, pg);
    assert.equal(merged.nextAction?.label, 'Register cameras');
    assert.equal(merged.camerasMapped.total, 0);
    assert.equal(merged.timetableEntries, 10);
  });

  it('active-only mem counts drop when entities deactivated', async () => {
    resetStoreForSeed();
    await seedDemoSchool(1);
    const before = getSetupHealth(1);
    for (const c of db.cameras().filter((x) => x.organizationId === 1)) c.status = 'Inactive';
    const after = getSetupHealth(1);
    assert.ok(before.camerasMapped.total > 0);
    assert.equal(after.camerasMapped.total, 0);
  });
});
