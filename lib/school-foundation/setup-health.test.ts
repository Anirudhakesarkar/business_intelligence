import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchool } from './seed';
import {
  createCalendarDay,
  createDutyRoster,
  createZone,
  db,
  getSetupHealth,
  getNextSetupAction,
  resetStoreForSeed,
} from './store';

describe('school-foundation setup health', () => {
  it('returns next action when no cameras registered', () => {
    resetStoreForSeed();
    const next = getNextSetupAction(1);
    assert.ok(next);
    assert.match(next!.href, /cameras/);
  });

  it('setup health includes calendar summary and next action fields', async () => {
    resetStoreForSeed();
    await seedDemoSchool(1);
    const health = getSetupHealth(1);
    assert.ok(health.calendarSummary.totalDays >= 30);
    assert.ok('nextAction' in health);
    assert.ok(health.completionPercent >= 0);
  });

  it('next action points to cameras when active cameras are unmapped', async () => {
    resetStoreForSeed();
    await seedDemoSchool(1);
    for (const c of db.cameras().filter((x) => x.organizationId === 1 && x.status === 'Active')) {
      c.zoneId = undefined;
      c.roomId = undefined;
    }
    const next = getNextSetupAction(1);
    assert.ok(next);
    assert.match(next!.href, /cameras/);
  });

  it('ignores orphan risk zones outside org campus hierarchy', async () => {
    resetStoreForSeed();
    await seedDemoSchool(1);
    const before = getSetupHealth(1);
    createZone({ name: 'Orphan Global Risk', zoneType: 'playground', isRiskZone: true, riskCategory: 'Playground' });
    const after = getSetupHealth(1);
    const riskMsg = (m: string[]) => m.filter((x) => x.includes('risk zone'));
    assert.deepEqual(riskMsg(after.missing), riskMsg(before.missing));
  });

  it('completionPercent is 100 only when ready for phase 2', async () => {
    resetStoreForSeed();
    await seedDemoSchool(1);
    const health = getSetupHealth(1);
    if (health.isReadyForPhase2) {
      assert.equal(health.completionPercent, 100);
      assert.equal(health.missing.length, 0);
    } else if (health.missing.length > 0) {
      assert.ok(health.completionPercent <= 99);
      assert.equal(health.isReadyForPhase2, false);
    }
  });

  it('counts only active cameras, timetable, and roster rows', async () => {
    resetStoreForSeed();
    await seedDemoSchool(1);
    const baseline = getSetupHealth(1);
    assert.ok(baseline.camerasMapped.total > 0);
    assert.ok(baseline.timetableEntries > 0);
    assert.ok(baseline.rosterEntries > 0);

    for (const c of db.cameras().filter((x) => x.organizationId === 1 && x.status === 'Active')) {
      c.status = 'Inactive';
    }
    for (const t of db.timetable().filter((x) => x.organizationId === 1 && x.isActive)) {
      t.isActive = false;
    }
    for (const r of db.rosters().filter((x) => x.organizationId === 1 && x.isActive)) {
      r.isActive = false;
    }

    const after = getSetupHealth(1);
    assert.equal(after.camerasMapped.total, 0);
    assert.equal(after.timetableEntries, 0);
    assert.equal(after.rosterEntries, 0);
  });

  it('logs audit on calendar and roster create', async () => {
    resetStoreForSeed();
    await seedDemoSchool(1);
    const before = db.auditLog().length;
    const zone = db.zones()[0];
    const staff = db.staff()[0];
    createCalendarDay({ organizationId: 1, calendarDate: '2099-12-01', dayType: 'Holiday', label: 'Test' });
    createDutyRoster({
      organizationId: 1,
      staffMemberId: staff.id,
      zoneId: zone.id,
      dutyType: 'Gate',
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '09:00',
      isCriticalWindow: false,
    });
    assert.ok(db.auditLog().length > before);
    assert.ok(db.auditLog().some((e) => e.entityType === 'school_calendar'));
    assert.ok(db.auditLog().some((e) => e.entityType === 'duty_roster'));
  });
});
