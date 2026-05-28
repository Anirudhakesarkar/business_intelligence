import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchool } from '../school-foundation/seed';
import { db } from '../school-foundation/store';
import { createEvent } from '../school-rule-engine/store';
import { mapEventToContext } from './context';

describe('school-daily-summaries context', () => {
  it('maps GateCongestion to Dispersal and ParentExperience', () => {
    seedDemoSchool(1);
    const gateCam = db.cameras().find((c) => c.purpose === 'Gate');
    assert.ok(gateCam);
    const event = createEvent({
      organizationId: 1,
      eventType: 'GateCongestion',
      module: 'ParentExperience',
      severity: 'Medium',
      status: 'Open',
      cameraId: gateCam!.id,
      zoneId: gateCam!.zoneId,
      startedAt: new Date().toISOString().replace(/T.*/, 'T15:30:00.000Z'),
      evidence: { summary: 'Gate crowding during dispersal' },
    });
    const ctx = mapEventToContext(event);
    assert.equal(ctx.timeWindow, 'Dispersal');
    assert.equal(ctx.processOwner, 'ParentExperience');
    assert.equal(ctx.excludeFromAggregation, false);
  });

  it('links TeacherSupervisionGap to timetable teacher', () => {
    seedDemoSchool(1);
    const tt = db.timetable().find((e) => e.teacherId && e.roomId);
    assert.ok(tt);
    const dayIso: Record<number, string> = {
      1: '2099-01-05', 2: '2099-01-06', 3: '2099-01-07', 4: '2099-01-08', 5: '2099-01-09',
    };
    const startedAt = `${dayIso[tt!.dayOfWeek] ?? '2099-01-05'}T${tt!.startTime}:00.000Z`;
    const event = createEvent({
      organizationId: 1,
      eventType: 'TeacherSupervisionGap',
      module: 'TeacherProductivity',
      severity: 'High',
      status: 'Open',
      roomId: tt!.roomId,
      startedAt,
      evidence: { summary: 'No teacher detected' },
    });
    const ctx = mapEventToContext(event);
    assert.ok(ctx.teacherIdExpected);
    assert.equal(ctx.sectionId, tt!.sectionId);
    assert.equal(ctx.subjectId, tt!.subjectId);
    assert.equal(ctx.processOwner, 'TeacherProductivity');
  });

  it('excludes holiday events from aggregation', () => {
    seedDemoSchool(1);
    const day = '2099-12-25';
    db.calendar().push({
      id: 99999,
      organizationId: 1,
      calendarDate: day,
      dayType: 'Holiday',
      label: 'Test holiday',
    });
    const event = createEvent({
      organizationId: 1,
      eventType: 'RunningDetected',
      module: 'Discipline',
      severity: 'Low',
      status: 'Open',
      startedAt: `${day}T10:00:00.000Z`,
      evidence: { summary: 'Running on holiday' },
    });
    const ctx = mapEventToContext(event);
    assert.equal(ctx.calendarDayType, 'Holiday');
    assert.equal(ctx.excludeFromAggregation, true);
  });

  it('maps gate event to duty roster role when roster covers window', () => {
    seedDemoSchool(1);
    const gateRoster = db.rosters().find((r) => r.dutyType === 'Gate' && r.organizationId === 1);
    assert.ok(gateRoster);
    const gateCam = db.cameras().find((c) => c.purpose === 'Gate');
    const startedAt = '2099-01-05T07:15:00.000Z';
    const event = createEvent({
      organizationId: 1,
      eventType: 'GateCongestion',
      module: 'ParentExperience',
      severity: 'Medium',
      status: 'Open',
      cameraId: gateCam?.id,
      zoneId: gateCam?.zoneId,
      startedAt,
      evidence: { summary: 'Gate queue' },
    });
    const ctx = mapEventToContext(event);
    assert.equal(ctx.dutyRosterRole, 'Gate');
    assert.equal(ctx.cameraPurpose, 'Gate');
    assert.ok(ctx.roomId == null || typeof ctx.roomId === 'number');
  });
});
