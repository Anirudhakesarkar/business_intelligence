import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { db, createTimetableEntry, createCalendarDay, createDutyRoster, patchCamera, listRooms } from './store';
import { seedDemoSchool } from './seed';

describe('foundation audit coverage', () => {
  it('logs audit for camera, timetable, calendar, and roster mutations', () => {
    seedDemoSchool(1);
    const before = db.auditLog().length;
    patchCamera(db.cameras().find((c) => c.organizationId === 1)!.id, { name: 'Audit coverage cam' });
    const cls = db.classes().find((c) => c.organizationId === 1)!;
    const section = db.sections().find((s) => s.classId === cls.id)!;
    const room = listRooms(1)[0];
    const teacher = db.teachers().find((t) => t.organizationId === 1)!;
    const zone = db.zones().find((z) => z.organizationId === 1) ?? db.zones()[0];
    const staff = db.staff().find((s) => s.organizationId === 1)!;
    createTimetableEntry({
      organizationId: 1,
      sectionId: section.id,
      roomId: room.id,
      teacherId: teacher.id,
      dayOfWeek: 7,
      startTime: '22:00',
      endTime: '22:45',
      periodType: 'Class',
    });
    createCalendarDay({ organizationId: 1, calendarDate: '2099-12-01', dayType: 'Holiday', label: 'audit test' });
    createDutyRoster({
      organizationId: 1,
      zoneId: zone.id,
      staffMemberId: staff.id,
      dutyRole: 'Gate',
      dayOfWeek: 7,
      startTime: '06:00',
      endTime: '06:30',
      isCriticalWindow: true,
    });
    const types = new Set(db.auditLog().slice(before).map((e) => e.entityType));
    for (const entity of ['camera', 'timetable', 'school_calendar', 'duty_roster']) {
      assert.ok(types.has(entity), `missing audit for ${entity}`);
    }
  });
});
