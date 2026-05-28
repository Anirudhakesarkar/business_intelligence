import type { CameraPurpose, ProcessOwner, RiskCategory } from './types';
import { demoMetadata, tagCurrentFoundationAsDemo } from './demo-tags';
import {
  createBuilding,
  createCalendarDay,
  createCamera,
  createClass,
  createDutyRoster,
  createFloor,
  createRoom,
  createSection,
  createSite,
  createStaff,
  createSubject,
  createTeacher,
  createTimeWindow,
  createTimetableEntry,
  createZone,
  getSetupHealth,
  patchComplianceConfig,
  resetStoreForSeed,
  syncSectionRoomMappingsFromTimetable,
} from './store';

const PURPOSES: CameraPurpose[] = [
  'Classroom', 'Gate', 'Corridor', 'Staircase', 'Playground', 'Lab', 'Library', 'Reception', 'Parking', 'RestrictedZone', 'Compliance',
];
const PROCESS: ProcessOwner[] = ['Academic', 'Discipline', 'Compliance', 'ParentExperience', 'StudentOccupancy', 'StaffDeployment'];

/** In-memory seed (when Postgres is disabled). */
export function seedDemoSchoolMemory(organizationId = 1) {
  resetStoreForSeed();

  const site = createSite({ organizationId, name: 'Greenfield International School', address: '12 Campus Road', isActive: true });
  const b1 = createBuilding({ siteId: site.id, name: 'Main Block', isActive: true });
  const b2 = createBuilding({ siteId: site.id, name: 'Science Block', isActive: true });
  const floors = [1, 2, 3, 4].flatMap((b) =>
    [b1, b2].map((building, bi) =>
      [1, 2].map((level) =>
        createFloor({ buildingId: building.id, name: `${building.name} L${level}`, levelNo: bi * 2 + level })
      )
    )
  ).flat();

  const riskSpecs: { name: string; riskCategory: RiskCategory; zoneType: string }[] = [
    { name: 'Main Gate', riskCategory: 'Gate', zoneType: 'gate' },
    { name: 'Bus Bay', riskCategory: 'BusBay', zoneType: 'transport' },
    { name: 'Playground A', riskCategory: 'Playground', zoneType: 'outdoor' },
    { name: 'Staircase East', riskCategory: 'Staircase', zoneType: 'circulation' },
    { name: 'Science Lab', riskCategory: 'Lab', zoneType: 'lab' },
    { name: 'Server Room', riskCategory: 'ServerRoom', zoneType: 'restricted' },
    { name: 'Fire Exit North', riskCategory: 'FireExit', zoneType: 'safety' },
    { name: 'Parking', riskCategory: 'Parking', zoneType: 'external' },
  ];
  const zones = [];
  for (let i = 0; i < 20; i++) {
    const spec = riskSpecs[i % riskSpecs.length];
    zones.push(
      createZone({
        floorId: floors[i % floors.length].id,
        name: i < riskSpecs.length ? spec.name : `${spec.name} ${Math.floor(i / riskSpecs.length) + 1}`,
        zoneType: spec.zoneType,
        isRiskZone: true,
        riskCategory: spec.riskCategory,
        capacity: 40 + (i % 10),
      })
    );
  }

  const rooms = [];
  for (let i = 1; i <= 30; i++) {
    rooms.push(
      createRoom({
        zoneId: zones[i % zones.length].id,
        roomCode: `R-${String(i).padStart(3, '0')}`,
        roomName: `Room ${i}`,
        roomType: i % 5 === 0 ? 'lab' : 'classroom',
        capacity: 28 + (i % 12),
        isActive: true,
      })
    );
  }

  const classes = [];
  for (let g = 1; g <= 10; g++) {
    classes.push(createClass({ organizationId, name: `Grade ${g}`, sortOrder: g, isActive: true }));
  }
  const sections = [];
  for (const cls of classes) {
    for (const letter of ['A', 'B', 'C']) {
      sections.push(
        createSection({ classId: cls.id, name: letter, expectedStudentCount: 28 + (cls.sortOrder % 5), isActive: true })
      );
    }
  }
  const subjects = [
    createSubject({ organizationId, name: 'Mathematics', subjectCode: 'MATH', isActive: true }),
    createSubject({ organizationId, name: 'Science', subjectCode: 'SCI', isActive: true }),
    createSubject({ organizationId, name: 'English', subjectCode: 'ENG', isActive: true }),
  ];
  const teachers = [];
  for (let t = 1; t <= 40; t++) {
    teachers.push(
      createTeacher({
        organizationId,
        employeeCode: `T-${String(t).padStart(3, '0')}`,
        name: `Teacher ${t}`,
        email: `teacher${t}@demo.school`,
        isActive: true,
      })
    );
  }
  const staff = [];
  const roles = ['Security', 'Coordinator', 'Lab Assistant', 'Reception'];
  for (let s = 1; s <= 20; s++) {
    staff.push(
      createStaff({
        organizationId,
        employeeCode: `S-${String(s).padStart(3, '0')}`,
        name: `Staff ${s}`,
        role: roles[s % roles.length],
        isActive: true,
      })
    );
  }

  const gateZone = zones.find((z) => z.name === 'Main Gate')!;
  let camCount = 0;
  for (let zi = 0; zi < zones.length; zi++) {
    const z = zones[zi];
    createCamera({
      organizationId,
      cameraCode: `CAM-RZ-${String(zi + 1).padStart(2, '0')}`,
      name: `${z.name} Risk Cam`,
      streamUrl: `rtsp://demo/risk-${zi + 1}`,
      purpose: z.riskCategory === 'ServerRoom' ? 'RestrictedZone' : z.riskCategory === 'Playground' ? 'Playground' : 'Corridor',
      processOwner: 'Compliance',
      criticality: z.riskCategory === 'ServerRoom' || z.riskCategory === 'Gate' ? 'Critical' : 'High',
      zoneId: z.id,
      status: 'Active',
      metadata: demoMetadata(),
    });
    camCount++;
  }
  for (let i = 1; i <= 25; i++) {
    const purpose = PURPOSES[i % PURPOSES.length];
    const needsRoom = purpose === 'Classroom' || purpose === 'Lab' || purpose === 'Library';
    const room = needsRoom ? rooms[(i * 3) % rooms.length] : undefined;
    const zone = room ? zones.find((z) => z.id === room.zoneId) : zones[i % zones.length];
    createCamera({
      organizationId,
      cameraCode: `CAM-${String(i).padStart(3, '0')}`,
      name: `${purpose} Cam ${i}`,
      streamUrl: `rtsp://demo/cam-${i}`,
      purpose,
      processOwner: PROCESS[i % PROCESS.length],
      criticality: i <= 5 ? 'Critical' : i <= 12 ? 'High' : 'Medium',
      zoneId: zone?.id,
      roomId: room?.id,
      status: 'Active',
      metadata: demoMetadata(
        purpose === 'Classroom'
          ? { teachingZones: { boardPolygon: [[0, 0], [100, 0], [100, 40]], deskPolygon: [[0, 50], [100, 50]] } }
          : undefined,
      ),
    });
    camCount++;
  }

  const windows = [
    ['Arrival', 'Arrival', '07:00', '08:30'],
    ['Period 1', 'Period', '08:30', '09:15'],
    ['Short Break', 'Break', '09:15', '09:30'],
    ['Lunch', 'Lunch', '12:00', '13:00'],
    ['Dispersal', 'Dispersal', '14:00', '15:30'],
  ] as const;
  for (const [name, wtype, start, end] of windows) {
    createTimeWindow({ organizationId, name, windowType: wtype, startTime: start, endTime: end, isActive: true });
  }

  let timetableCount = 0;
  const slots = ['08:30', '09:20', '10:10', '11:00', '11:50', '12:40', '13:30', '14:20'];
  const ends = ['09:15', '10:05', '10:55', '11:45', '12:35', '13:25', '14:15', '15:05'];
  outer: for (let day = 1; day <= 5; day++) {
    for (let slotIdx = 0; slotIdx < slots.length; slotIdx++) {
      for (const section of sections) {
        if (timetableCount >= 200) break outer;
        const room = rooms[timetableCount % rooms.length];
        createTimetableEntry({
          organizationId,
          sectionId: section.id,
          subjectId: subjects[timetableCount % subjects.length].id,
          roomId: room.id,
          teacherId: teachers[timetableCount % teachers.length].id,
          periodType: 'Class',
          dayOfWeek: day,
          startTime: slots[slotIdx],
          endTime: ends[slotIdx],
        });
        timetableCount++;
      }
    }
  }

  const dutyTypes = ['Gate', 'Corridor', 'Playground', 'Bus Bay', 'Lab', 'Reception', 'Emergency Exit'];
  let rosterCount = 0;
  outerRoster: for (let day = 1; day <= 5; day++) {
    for (const duty of dutyTypes) {
      for (const zone of zones) {
        if (rosterCount >= 50) break outerRoster;
        createDutyRoster({
          organizationId,
          staffMemberId: staff[rosterCount % staff.length].id,
          zoneId: zone.id,
          dutyType: duty,
          dayOfWeek: day,
          startTime: duty === 'Gate' ? '07:00' : '08:00',
          endTime: duty === 'Gate' ? '08:30' : '15:30',
          isCriticalWindow: duty === 'Gate' || duty === 'Bus Bay',
        });
        rosterCount++;
      }
    }
  }

  const today = new Date();
  for (let i = 0; i < 35; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    createCalendarDay({
      organizationId,
      calendarDate: iso,
      dayType: dow === 0 ? 'Holiday' : 'WorkingDay',
      label: dow === 0 ? 'Sunday' : undefined,
    });
  }

  patchComplianceConfig(organizationId, {
    restrictedZoneIds: zones.filter((z) => z.riskCategory === 'ServerRoom' || z.riskCategory === 'FireExit').map((z) => z.id),
    safetyRules: ['No running in corridors during class hours', 'Fire exits must remain clear', 'Lab requires supervision when occupied'],
  });

  syncSectionRoomMappingsFromTimetable(organizationId);

  const health = getSetupHealth(organizationId);
  return {
    siteId: site.id,
    organizationId,
    counts: {
      zones: zones.length,
      rooms: rooms.length,
      cameras: camCount,
      classes: classes.length,
      sections: sections.length,
      teachers: teachers.length,
      staff: staff.length,
      timetable: timetableCount,
      roster: rosterCount,
      calendar: 35,
    },
    setupHealth: health,
  };
}

/** Seed demo campus data — Postgres when configured, otherwise in-memory. */
export async function seedDemoSchool(organizationId = 1) {
  const { isDbEnabled } = await import('../school-db/pool');
  if (isDbEnabled()) {
    const { seedDemoSchoolPg } = await import('./seed-pg');
    return seedDemoSchoolPg(organizationId);
  }
  const result = seedDemoSchoolMemory(organizationId);
  await tagCurrentFoundationAsDemo(organizationId);
  return result;
}
