import type { CameraPurpose, ProcessOwner, RiskCategory } from './types';
import { resolveOrgIdForPg } from '../school-db/organization-id';
import { dbQuery, isDbEnabled } from '../school-db/pool';
import { hydrateFoundationFromPg } from './repos';
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
  createStaffMember,
  createSubject,
  createTeacher,
  createTimeWindow,
  createTimetableEntry,
  createZone,
} from './repos';
import { clearDemoTagsForOrg, demoMetadata, tagCurrentFoundationAsDemo } from './demo-tags';
import { getSetupHealth, patchComplianceConfig, resetStoreForSeed, syncSectionRoomMappingsFromTimetable } from './store';

const PURPOSES: CameraPurpose[] = [
  'Classroom', 'Gate', 'Corridor', 'Staircase', 'Playground', 'Lab', 'Library', 'Reception', 'Parking', 'RestrictedZone', 'Compliance',
];
const PROCESS: ProcessOwner[] = ['Academic', 'Discipline', 'Compliance', 'ParentExperience', 'StudentOccupancy', 'StaffDeployment'];

async function hasTable(tableName: string): Promise<boolean> {
  const r = await dbQuery<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS "exists"`,
    [tableName],
  );
  return Boolean(r?.rows?.[0]?.exists);
}

export type FoundationOrgCounts = Record<string, number>;

/** Dry-run row counts for foundation data scoped to an organization (Postgres). */
export async function countFoundationForOrg(organizationId: number): Promise<FoundationOrgCounts> {
  if (!isDbEnabled()) return {};
  const pgOrg = resolveOrgIdForPg(organizationId);
  const siteTable = (await hasTable('school_sites')) ? 'school_sites' : (await hasTable('school_campuses')) ? 'school_campuses' : null;
  const buildingSiteCol =
    (await hasTable('school_buildings'))
      ? (await hasTable('school_sites') ? 'site_id' : 'campus_id')
      : null;

  const counts: FoundationOrgCounts = {};
  const countSql = async (label: string, sql: string, params: unknown[] = []) => {
    const r = await dbQuery<{ count: string }>(sql, params);
    counts[label] = Number(r?.rows[0]?.count ?? 0);
  };

  if (siteTable) {
    await countSql('sites', `SELECT COUNT(*)::text AS count FROM ${siteTable} WHERE organization_id = $1`, [pgOrg]);
  }
  if (siteTable && buildingSiteCol) {
    await countSql(
      'buildings',
      `SELECT COUNT(*)::text AS count FROM school_buildings b
       JOIN ${siteTable} s ON s.id = b.${buildingSiteCol} WHERE s.organization_id = $1`,
      [pgOrg],
    );
    await countSql(
      'floors',
      `SELECT COUNT(*)::text AS count FROM school_floors f
       JOIN school_buildings b ON b.id = f.building_id
       JOIN ${siteTable} s ON s.id = b.${buildingSiteCol} WHERE s.organization_id = $1`,
      [pgOrg],
    );
    await countSql(
      'zones',
      `SELECT COUNT(*)::text AS count FROM school_zones z
       JOIN school_floors f ON f.id = z.floor_id
       JOIN school_buildings b ON b.id = f.building_id
       JOIN ${siteTable} s ON s.id = b.${buildingSiteCol} WHERE s.organization_id = $1`,
      [pgOrg],
    );
    await countSql(
      'rooms',
      `SELECT COUNT(*)::text AS count FROM school_rooms r
       JOIN school_zones z ON z.id = r.zone_id
       JOIN school_floors f ON f.id = z.floor_id
       JOIN school_buildings b ON b.id = f.building_id
       JOIN ${siteTable} s ON s.id = b.${buildingSiteCol} WHERE s.organization_id = $1`,
      [pgOrg],
    );
  }

  const orgTables: [string, string][] = [
    ['cameras', 'school_mgmt_cameras'],
    ['classes', 'school_classes'],
    ['subjects', 'school_subjects'],
    ['teachers', 'school_teachers'],
    ['staff', 'school_staff_members'],
    ['timetable', 'school_timetable_entries'],
    ['rosters', 'school_staff_duty_rosters'],
    ['calendar', 'school_calendars'],
    ['timeWindows', 'school_time_windows'],
  ];
  for (const [label, table] of orgTables) {
    if (await hasTable(table)) {
      await countSql(label, `SELECT COUNT(*)::text AS count FROM ${table} WHERE organization_id = $1`, [pgOrg]);
    }
  }

  if (await hasTable('school_sections') && await hasTable('school_classes')) {
    await countSql(
      'sections',
      `SELECT COUNT(*)::text AS count FROM school_sections sec
       JOIN school_classes c ON c.id = sec.class_id WHERE c.organization_id = $1`,
      [pgOrg],
    );
  }

  counts.total = Object.entries(counts).reduce((sum, [k, v]) => (k === 'total' ? sum : sum + v), 0);
  return counts;
}

/** Remove all foundation master data for an org in Postgres (and in-memory cache). */
export async function clearFoundationForOrg(organizationId: number) {
  if (!isDbEnabled()) return;
  const pgOrg = resolveOrgIdForPg(organizationId);
  const siteTable = (await hasTable('school_sites')) ? 'school_sites' : (await hasTable('school_campuses')) ? 'school_campuses' : null;
  const buildingSiteCol = (await hasTable('school_buildings'))
    ? (await hasTable('school_sites') ? 'site_id' : 'campus_id')
    : null;

  // Remove spatial tree by org via joins (safe even when FK cascade behavior differs across local schemas).
  if (siteTable && buildingSiteCol && await hasTable('school_rooms')) {
    await dbQuery(
      `DELETE FROM school_rooms
       WHERE zone_id IN (
         SELECT z.id
         FROM school_zones z
         JOIN school_floors f ON f.id = z.floor_id
         JOIN school_buildings b ON b.id = f.building_id
         JOIN ${siteTable} s ON s.id = b.${buildingSiteCol}
         WHERE s.organization_id = $1
       )`,
      [pgOrg]
    );
  }
  if (siteTable && buildingSiteCol && await hasTable('school_zones')) {
    await dbQuery(
      `DELETE FROM school_zones
       WHERE floor_id IN (
         SELECT f.id
         FROM school_floors f
         JOIN school_buildings b ON b.id = f.building_id
         JOIN ${siteTable} s ON s.id = b.${buildingSiteCol}
         WHERE s.organization_id = $1
       )`,
      [pgOrg]
    );
  }
  if (siteTable && buildingSiteCol && await hasTable('school_floors')) {
    await dbQuery(
      `DELETE FROM school_floors
       WHERE building_id IN (
         SELECT b.id
         FROM school_buildings b
         JOIN ${siteTable} s ON s.id = b.${buildingSiteCol}
         WHERE s.organization_id = $1
       )`,
      [pgOrg]
    );
  }
  if (siteTable && buildingSiteCol && await hasTable('school_buildings')) {
    await dbQuery(
      `DELETE FROM school_buildings
       WHERE ${buildingSiteCol} IN (
         SELECT id FROM ${siteTable} WHERE organization_id = $1
       )`,
      [pgOrg]
    );
  }

  const tables = [
    'school_timetable_entries',
    'school_staff_duty_rosters',
    'school_mgmt_cameras',
    'school_calendars',
    'school_time_windows',
    'school_classes',
    'school_subjects',
    'school_teachers',
    'school_staff_members',
    'school_sites',
  ];
  for (const table of tables) {
    if (await hasTable(table)) {
      await dbQuery(`DELETE FROM ${table} WHERE organization_id = $1`, [pgOrg]);
    }
  }
  // Some DBs use campus naming; clean that path too.
  if (await hasTable('school_campuses')) {
    await dbQuery(`DELETE FROM school_campuses WHERE organization_id = $1`, [pgOrg]);
  }
  await clearDemoTagsForOrg(organizationId);
  resetStoreForSeed();
}

export async function seedDemoSchoolPg(organizationId = 1) {
  if (!isDbEnabled()) {
    throw new Error('Postgres is not configured');
  }

  await clearFoundationForOrg(organizationId);

  const result = await seedFoundationHierarchyPg(organizationId, 'Greenfield International School');
  await tagCurrentFoundationAsDemo(organizationId);
  await hydrateFoundationFromPg();

  const health = getSetupHealth(organizationId);
  return {
    siteId: result.siteId,
    organizationId,
    storage: 'postgres' as const,
    counts: result.counts,
    setupHealth: health,
  };
}

/** Seed campus hierarchy when no sites exist; does not tag demo entities or wipe intelligence tables. */
export async function seedFoundationIfEmptyPg(organizationId = 1) {
  if (!isDbEnabled()) {
    throw new Error('Postgres is not configured');
  }

  const existing = await countFoundationForOrg(organizationId);
  if ((existing.sites ?? 0) > 0) {
    await hydrateFoundationFromPg();
    return { skipped: true, reason: 'foundation_exists' as const, counts: existing, storage: 'postgres' as const };
  }

  const { removeOrphanSpatialRows } = await import('./repos/orphan-spatial');
  await removeOrphanSpatialRows({ dryRun: false });
  resetStoreForSeed();

  const result = await seedFoundationHierarchyPg(organizationId, 'Main Campus');
  await hydrateFoundationFromPg();

  const health = getSetupHealth(organizationId);
  return {
    skipped: false,
    siteId: result.siteId,
    organizationId,
    storage: 'postgres' as const,
    counts: result.counts,
    setupHealth: health,
  };
}

async function seedFoundationHierarchyPg(organizationId: number, siteName: string) {
  const site = await createSite({
    organizationId,
    name: siteName,
    address: '12 Campus Road',
    isActive: true,
  });
  const b1 = await createBuilding({ siteId: site.id, name: 'Main Block', isActive: true });
  const b2 = await createBuilding({ siteId: site.id, name: 'Science Block', isActive: true });

  const floors = (
    await Promise.all(
      [b1, b2].flatMap((building, bi) =>
        [1, 2].map((level) =>
          createFloor({
            buildingId: building.id,
            name: `${building.name} L${level}`,
            levelNo: bi * 2 + level,
          }),
        ),
      ),
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
      await createZone({
        floorId: floors[i % floors.length].id,
        name: i < riskSpecs.length ? spec.name : `${spec.name} ${Math.floor(i / riskSpecs.length) + 1}`,
        zoneType: spec.zoneType,
        isRiskZone: true,
        riskCategory: spec.riskCategory,
        capacity: 40 + (i % 10),
      }),
    );
  }

  const rooms = [];
  for (let i = 1; i <= 30; i++) {
    rooms.push(
      await createRoom({
        zoneId: zones[i % zones.length].id,
        roomCode: `R-${String(i).padStart(3, '0')}`,
        roomName: `Room ${i}`,
        roomType: i % 5 === 0 ? 'lab' : 'classroom',
        capacity: 28 + (i % 12),
        isActive: true,
      }),
    );
  }

  const classes = [];
  for (let g = 1; g <= 10; g++) {
    classes.push(
      await createClass({ organizationId, name: `Grade ${g}`, sortOrder: g, isActive: true }),
    );
  }

  const sections = [];
  for (const cls of classes) {
    for (const letter of ['A', 'B', 'C']) {
      sections.push(
        await createSection({
          classId: cls.id,
          name: letter,
          expectedStudentCount: 28 + (cls.sortOrder % 5),
          isActive: true,
        }),
      );
    }
  }

  const subjects = await Promise.all([
    createSubject({ organizationId, name: 'Mathematics', subjectCode: 'MATH', isActive: true }),
    createSubject({ organizationId, name: 'Science', subjectCode: 'SCI', isActive: true }),
    createSubject({ organizationId, name: 'English', subjectCode: 'ENG', isActive: true }),
  ]);

  const teachers = [];
  for (let t = 1; t <= 40; t++) {
    teachers.push(
      await createTeacher({
        organizationId,
        employeeCode: `T-${String(t).padStart(3, '0')}`,
        name: `Teacher ${t}`,
        email: `teacher${t}@demo.school`,
        isActive: true,
      }),
    );
  }

  const roles = ['Security', 'Coordinator', 'Lab Assistant', 'Reception'];
  const staff = [];
  for (let s = 1; s <= 20; s++) {
    staff.push(
      await createStaffMember({
        organizationId,
        employeeCode: `S-${String(s).padStart(3, '0')}`,
        name: `Staff ${s}`,
        role: roles[s % roles.length],
        isActive: true,
      }),
    );
  }

  let camCount = 0;
  for (let zi = 0; zi < zones.length; zi++) {
    const z = zones[zi];
    await createCamera({
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
    await createCamera({
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
    await createTimeWindow({ organizationId, name, windowType: wtype, startTime: start, endTime: end, isActive: true });
  }

  let timetableCount = 0;
  const slots = ['08:30', '09:20', '10:10', '11:00', '11:50', '12:40', '13:30', '14:20'];
  const ends = ['09:15', '10:05', '10:55', '11:45', '12:35', '13:25', '14:15', '15:05'];
  outer: for (let day = 1; day <= 5; day++) {
    for (let slotIdx = 0; slotIdx < slots.length; slotIdx++) {
      for (const section of sections) {
        if (timetableCount >= 200) break outer;
        const room = rooms[timetableCount % rooms.length];
        await createTimetableEntry({
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
        await createDutyRoster({
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
    await createCalendarDay({
      organizationId,
      calendarDate: iso,
      dayType: dow === 0 ? 'Holiday' : 'WorkingDay',
      label: dow === 0 ? 'Sunday' : undefined,
    });
  }

  patchComplianceConfig(organizationId, {
    restrictedZoneIds: zones
      .filter((z) => z.riskCategory === 'ServerRoom' || z.riskCategory === 'FireExit')
      .map((z) => z.id),
    safetyRules: [
      'No running in corridors during class hours',
      'Fire exits must remain clear',
      'Lab requires supervision when occupied',
    ],
  });

  syncSectionRoomMappingsFromTimetable(organizationId);

  return {
    siteId: site.id,
    counts: {
      sites: 1,
      buildings: 2,
      floors: floors.length,
      zones: zones.length,
      rooms: rooms.length,
      cameras: camCount + 25,
      classes: classes.length,
      sections: sections.length,
      subjects: subjects.length,
      teachers: teachers.length,
      staff: staff.length,
      timetable: timetableCount,
      roster: rosterCount,
      calendar: 35,
    },
  };
}
