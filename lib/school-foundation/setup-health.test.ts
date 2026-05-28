import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchool } from './seed';
import {
  createCalendarDay,
  createDutyRoster,
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
    });
    assert.ok(db.auditLog().length > before);
    assert.ok(db.auditLog().some((e) => e.entityType === 'school_calendar'));
    assert.ok(db.auditLog().some((e) => e.entityType === 'duty_roster'));
  });
});
