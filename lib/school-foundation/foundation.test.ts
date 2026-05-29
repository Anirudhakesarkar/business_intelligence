import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchool } from './seed';
import {
  createCamera,
  createDutyRoster,
  createRoom,
  getSetupHealth,
  patchSection,
  validateTimetableImport,
  db,
  getComplianceConfig,
  getSectionRoomMapping,
  resetStoreForSeed,
  setSectionRoomMapping,
} from './store';

describe('school-foundation', () => {
  it('seed meets Phase 1 README minimums', async () => {
    const r = await seedDemoSchool(1);
    assert.ok(r.counts.zones >= 20);
    assert.ok(r.counts.rooms >= 30);
    assert.ok(r.counts.cameras >= 25);
    assert.ok(r.counts.sections >= 30);
    assert.ok(r.counts.teachers >= 40);
    assert.ok(r.counts.timetable >= 200);
    assert.ok(r.counts.roster >= 50);
    assert.equal(r.setupHealth.isReadyForPhase2, true);
  });

  it('patchSection updates expected student count', () => {
    seedDemoSchool(1);
    const sec = db.sections()[0];
    const updated = patchSection(sec.id, { expectedStudentCount: 40 });
    assert.equal(updated.expectedStudentCount, 40);
  });

  it('timetable import rejects overlaps', () => {
    seedDemoSchool(1);
    const v = validateTimetableImport(1, [
      { sectionId: 1, roomId: 1, dayOfWeek: 1, startTime: '08:00', endTime: '09:00' },
      { sectionId: 2, roomId: 1, dayOfWeek: 1, startTime: '08:30', endTime: '09:30' },
    ]);
    assert.equal(v.valid, false);
  });

  it('rejects room capacity below 1', () => {
    seedDemoSchool(1);
    const zone = db.zones()[0];
    assert.throws(
      () =>
        createRoom({
          zoneId: zone.id,
          roomCode: 'BAD',
          roomName: 'Invalid',
          roomType: 'classroom',
          capacity: 0,
          isActive: true,
        }),
      /capacity must be at least 1/
    );
  });

  it('rejects classroom camera without room mapping', () => {
    seedDemoSchool(1);
    const zone = db.zones()[0];
    assert.throws(
      () =>
        createCamera({
          organizationId: 1,
          cameraCode: 'CAM-INVALID',
          name: 'Unmapped classroom',
          streamUrl: 'rtsp://demo',
          purpose: 'Classroom',
          processOwner: 'Academic',
          criticality: 'Medium',
          zoneId: zone.id,
          status: 'Active',
        }),
      /must be mapped to a room/
    );
  });

  it('accepts gate camera with zone only', () => {
    seedDemoSchool(1);
    const zone = db.zones().find((z) => z.name === 'Main Gate') ?? db.zones()[0];
    const cam = createCamera({
      organizationId: 1,
      cameraCode: 'CAM-GATE-TEST',
      name: 'Gate test',
      streamUrl: 'rtsp://demo/gate',
      purpose: 'Gate',
      processOwner: 'ParentExperience',
      criticality: 'High',
      zoneId: zone.id,
      status: 'Active',
    });
    assert.ok(cam.id);
    assert.equal(cam.zoneId, zone.id);
  });

  it('rejects duty roster with end before start', () => {
    seedDemoSchool(1);
    const zone = db.zones()[0];
    const staff = db.staff()[0];
    assert.throws(
      () =>
        createDutyRoster({
          organizationId: 1,
          staffMemberId: staff.id,
          zoneId: zone.id,
          dutyType: 'Gate',
          dayOfWeek: 1,
          startTime: '15:00',
          endTime: '14:00',
          isCriticalWindow: false,
        }),
      /End time must be after start time/
    );
  });
  it('seeds server room and fire exit risk zones with compliance config', () => {
    resetStoreForSeed();
    seedDemoSchool(1);
    const risk = db.zones().filter((z) => z.isRiskZone);
    assert.ok(risk.some((z) => z.riskCategory === 'ServerRoom'));
    assert.ok(risk.some((z) => z.riskCategory === 'FireExit'));
    const cfg = getComplianceConfig(1);
    assert.ok(cfg.restrictedZoneIds.length >= 1);
    assert.ok(cfg.auditChecklist.length >= 2);
  });


  it('section room mapping from timetable and explicit set', () => {
    resetStoreForSeed();
    seedDemoSchool(1);
    const section = db.sections()[0];
    assert.ok(getSectionRoomMapping(section.id)?.roomId);
    setSectionRoomMapping(section.id, db.rooms()[1].id, true);
    assert.equal(getSectionRoomMapping(section.id)?.roomId, db.rooms()[1].id);
  });
});
