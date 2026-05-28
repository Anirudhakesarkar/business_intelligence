/**
 * Master Data CSV bulk import — dry-run preview and atomic Postgres commit.
 */
import type { Site, Building, Floor, Zone, Room, SchoolClass, Section } from '../types';
import { orgIdFromPg, resolveOrgIdForPg } from '../../school-db/organization-id';
import { createSite, listSites } from './sites';
import {
  createBuilding,
  createFloor,
  createZone,
  createRoom,
  listBuildings,
  listFloors,
  listZonesForOrganization,
  listRooms,
} from './foundation-spatial';
import {
  createClass,
  createSection,
  createSubject,
  createTeacher,
  createStaffMember,
  listClasses,
  listSections,
  listSubjects,
  listTeachers,
  listStaffMembers,
} from './foundation-org';
import { columnExists, isDbEnabled, tableExists, withDbTransaction, type DbQueryFn } from './shared';

export type ImportRow = Record<string, string>;

export interface EntityResult {
  type: string;
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export type MasterDataImportResult = {
  dryRun: boolean;
  totalCreated: number;
  totalErrors: number;
  totalSkipped: number;
  results: EntityResult[];
  committed?: boolean;
  atomicAborted?: boolean;
};

type SiteSchema = { table: 'school_sites' | 'school_campuses'; nameColumn: 'name' | 'campus_name' };

type TxSchema = {
  site: SiteSchema;
  buildingSiteColumn: 'site_id' | 'campus_id';
};

type ImportOpts = {
  dryRun: boolean;
  query?: DbQueryFn;
  txSchema?: TxSchema;
};

function parseBool(v: string | undefined, def = true): boolean {
  if (v === undefined || v === '') return def;
  return !['false', '0', 'no', 'inactive', 'n'].includes(v.toLowerCase());
}

function parseNum(v: string | undefined, def = 0): number {
  if (v === undefined || v === '') return def;
  const n = Number(v);
  return isNaN(n) ? def : n;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

export function parseMasterDataCSV(text: string): ImportRow[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  return lines
    .slice(1)
    .map((line) => {
      const vals = parseCSVLine(line);
      const row: ImportRow = {};
      headers.forEach((h, i) => {
        row[h] = (vals[i] ?? '').trim();
      });
      return row;
    })
    .filter((r) => r['type'] && r['type'].length > 0);
}

async function resolveTxSchema(): Promise<TxSchema> {
  let site: SiteSchema;
  if (await tableExists('school_sites')) {
    site = { table: 'school_sites', nameColumn: 'name' };
  } else if (await tableExists('school_campuses')) {
    const hasName = await columnExists('school_campuses', 'name');
    site = { table: 'school_campuses', nameColumn: hasName ? 'name' : 'campus_name' };
  } else {
    site = { table: 'school_sites', nameColumn: 'name' };
  }
  const buildingSiteColumn = (await columnExists('school_buildings', 'site_id')) ? 'site_id' : 'campus_id';
  return { site, buildingSiteColumn };
}

async function refreshMasterDataCaches(organizationId: number): Promise<void> {
  await Promise.all([
    listSites(organizationId),
    listBuildings(),
    listFloors(),
    listZonesForOrganization(organizationId),
    listClasses(organizationId),
    listSections(),
    listSubjects(organizationId),
    listTeachers(organizationId),
    listStaffMembers(organizationId),
    listRooms(organizationId),
  ]);
}

async function insertSiteTx(
  query: DbQueryFn,
  schema: SiteSchema,
  organizationId: number,
  input: { name: string; address?: string; isActive: boolean },
): Promise<Site> {
  const r = await query<{ id: string | number; organization_id: string | number; name: string; address: string | null; is_active: boolean }>(
    `INSERT INTO ${schema.table} (organization_id, ${schema.nameColumn}, address, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING id, organization_id, ${schema.nameColumn} AS name, address, is_active`,
    [resolveOrgIdForPg(organizationId), input.name.trim(), input.address ?? null, input.isActive],
  );
  if (!r?.rows[0]) throw new Error('Failed to create site');
  return {
    id: Number(r.rows[0].id),
    organizationId: orgIdFromPg(r.rows[0].organization_id),
    name: r.rows[0].name,
    address: r.rows[0].address ?? undefined,
    isActive: r.rows[0].is_active,
  };
}

async function insertBuildingTx(
  query: DbQueryFn,
  siteColumn: 'site_id' | 'campus_id',
  input: { siteId: number; name: string; isActive: boolean },
): Promise<Building> {
  const r = await query<{ id: string | number; site_id: string | number; name: string; is_active: boolean }>(
    `INSERT INTO school_buildings (${siteColumn}, name, is_active) VALUES ($1, $2, $3)
     RETURNING id, ${siteColumn} AS site_id, name, is_active`,
    [input.siteId, input.name.trim(), input.isActive],
  );
  if (!r?.rows[0]) throw new Error('Failed to create building');
  return {
    id: Number(r.rows[0].id),
    siteId: Number(r.rows[0].site_id),
    name: r.rows[0].name,
    isActive: r.rows[0].is_active,
  };
}

async function insertFloorTx(
  query: DbQueryFn,
  input: { buildingId: number; name: string; levelNo: number },
): Promise<Floor> {
  const r = await query<{ id: string | number; building_id: string | number; name: string; level_no: number }>(
    `INSERT INTO school_floors (building_id, name, level_no) VALUES ($1, $2, $3)
     RETURNING id, building_id, name, level_no`,
    [input.buildingId, input.name.trim(), input.levelNo],
  );
  if (!r?.rows[0]) throw new Error('Failed to create floor');
  return {
    id: Number(r.rows[0].id),
    buildingId: Number(r.rows[0].building_id),
    name: r.rows[0].name,
    levelNo: r.rows[0].level_no,
  };
}

async function insertZoneTx(
  query: DbQueryFn,
  input: {
    floorId?: number;
    name: string;
    zoneType: string;
    isRiskZone: boolean;
    riskCategory?: string;
    capacity?: number;
  },
): Promise<Zone> {
  const r = await query<{
    id: string | number;
    floor_id: string | number | null;
    name: string;
    zone_type: string;
    is_risk_zone: boolean;
    risk_category: string | null;
    capacity: number | null;
  }>(
    `INSERT INTO school_zones (floor_id, name, zone_type, is_risk_zone, risk_category, capacity)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, floor_id, name, zone_type, is_risk_zone, risk_category, capacity`,
    [
      input.floorId ?? null,
      input.name.trim(),
      input.zoneType,
      input.isRiskZone,
      input.riskCategory ?? null,
      input.capacity ?? null,
    ],
  );
  if (!r?.rows[0]) throw new Error('Failed to create zone');
  return {
    id: Number(r.rows[0].id),
    floorId: r.rows[0].floor_id != null ? Number(r.rows[0].floor_id) : undefined,
    name: r.rows[0].name,
    zoneType: r.rows[0].zone_type,
    isRiskZone: r.rows[0].is_risk_zone,
    riskCategory: (r.rows[0].risk_category as Zone['riskCategory']) ?? undefined,
    capacity: r.rows[0].capacity ?? undefined,
  };
}

async function insertRoomTx(
  query: DbQueryFn,
  input: {
    zoneId?: number;
    roomCode: string;
    roomName: string;
    roomType: string;
    capacity: number;
    isActive: boolean;
  },
): Promise<Room> {
  const r = await query<{
    id: string | number;
    zone_id: string | number | null;
    room_code: string;
    room_name: string;
    room_type: string;
    capacity: number;
    is_active: boolean;
  }>(
    `INSERT INTO school_rooms (zone_id, room_code, room_name, room_type, capacity, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, zone_id, room_code, room_name, room_type, capacity, is_active`,
    [
      input.zoneId ?? null,
      input.roomCode.trim(),
      input.roomName.trim(),
      input.roomType,
      input.capacity,
      input.isActive,
    ],
  );
  if (!r?.rows[0]) throw new Error('Failed to create room');
  return {
    id: Number(r.rows[0].id),
    zoneId: r.rows[0].zone_id != null ? Number(r.rows[0].zone_id) : undefined,
    roomCode: r.rows[0].room_code,
    roomName: r.rows[0].room_name,
    roomType: r.rows[0].room_type,
    capacity: r.rows[0].capacity,
    isActive: r.rows[0].is_active,
  };
}

async function insertClassTx(
  query: DbQueryFn,
  organizationId: number,
  input: { name: string; sortOrder: number; isActive: boolean },
): Promise<SchoolClass> {
  const r = await query<{
    id: string | number;
    organization_id: string | number;
    name: string;
    sort_order: number;
    is_active: boolean;
  }>(
    `INSERT INTO school_classes (organization_id, name, sort_order, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING id, organization_id, name, sort_order, is_active`,
    [resolveOrgIdForPg(organizationId), input.name.trim(), input.sortOrder, input.isActive],
  );
  if (!r?.rows[0]) throw new Error('Failed to create class');
  return {
    id: Number(r.rows[0].id),
    organizationId: orgIdFromPg(r.rows[0].organization_id),
    name: r.rows[0].name,
    sortOrder: r.rows[0].sort_order,
    isActive: r.rows[0].is_active,
  };
}

async function insertSectionTx(
  query: DbQueryFn,
  input: { classId: number; name: string; expectedStudentCount: number; isActive: boolean },
): Promise<Section> {
  const r = await query<{
    id: string | number;
    class_id: string | number;
    name: string;
    expected_student_count: number;
    is_active: boolean;
  }>(
    `INSERT INTO school_sections (class_id, name, expected_student_count, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING id, class_id, name, expected_student_count, is_active`,
    [input.classId, input.name.trim(), input.expectedStudentCount, input.isActive],
  );
  if (!r?.rows[0]) throw new Error('Failed to create section');
  return {
    id: Number(r.rows[0].id),
    classId: Number(r.rows[0].class_id),
    name: r.rows[0].name,
    expectedStudentCount: r.rows[0].expected_student_count,
    isActive: r.rows[0].is_active,
  };
}

async function insertSubjectTx(
  query: DbQueryFn,
  organizationId: number,
  input: { name: string; subjectCode?: string; isActive: boolean },
): Promise<void> {
  const r = await query(
    `INSERT INTO school_subjects (organization_id, name, subject_code, is_active)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [resolveOrgIdForPg(organizationId), input.name.trim(), input.subjectCode ?? null, input.isActive],
  );
  if (!r?.rows[0]) throw new Error('Failed to create subject');
}

async function insertTeacherTx(
  query: DbQueryFn,
  organizationId: number,
  input: { employeeCode?: string; name: string; email?: string; phone?: string; isActive: boolean },
): Promise<void> {
  const r = await query(
    `INSERT INTO school_teachers (organization_id, employee_code, name, email, phone, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      resolveOrgIdForPg(organizationId),
      input.employeeCode ?? null,
      input.name.trim(),
      input.email ?? null,
      input.phone ?? null,
      input.isActive,
    ],
  );
  if (!r?.rows[0]) throw new Error('Failed to create teacher');
}

async function insertStaffTx(
  query: DbQueryFn,
  organizationId: number,
  input: { employeeCode?: string; name: string; role: string; phone?: string; isActive: boolean },
): Promise<void> {
  const r = await query(
    `INSERT INTO school_staff_members (organization_id, employee_code, name, role, phone, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      resolveOrgIdForPg(organizationId),
      input.employeeCode ?? null,
      input.name.trim(),
      input.role,
      input.phone ?? null,
      input.isActive,
    ],
  );
  if (!r?.rows[0]) throw new Error('Failed to create staff member');
}

/** Run import (dry-run simulates; pass `query` for transactional inserts). */
export async function importMasterDataBulk(
  organizationId: number,
  rows: ImportRow[],
  options: ImportOpts,
): Promise<MasterDataImportResult> {
  const { dryRun, query } = options;
  const txSchema = query ? (options.txSchema ?? (await resolveTxSchema())) : undefined;
  const inTx = Boolean(query);
  const buildingsList = await listBuildings();

  const siteMap = new Map<string, number>();
  const bldMap = new Map<string, number>();
  const floorMap = new Map<string, number>();
  const zoneMap = new Map<string, number>();
  const classMap = new Map<string, number>();

  for (const s of await listSites(organizationId)) siteMap.set(s.name.toLowerCase(), s.id);
  for (const b of buildingsList) bldMap.set(b.name.toLowerCase(), b.id);
  for (const f of await listFloors()) {
    const bName = buildingsList.find((b) => b.id === f.buildingId)?.name ?? '';
    floorMap.set(`${bName.toLowerCase()}||${f.name.toLowerCase()}`, f.id);
  }
  for (const z of await listZonesForOrganization(organizationId)) zoneMap.set(z.name.toLowerCase(), z.id);
  for (const c of await listClasses(organizationId)) classMap.set(c.name.toLowerCase(), c.id);

  const byType = (t: string) => rows.filter((r) => r['type']?.toLowerCase() === t);
  const results: EntityResult[] = [];

  const handleRow = async (
    fn: () => Promise<void>,
    res: EntityResult,
    rowIndex: number,
  ): Promise<void> => {
    if (inTx) {
      await fn();
      return;
    }
    try {
      await fn();
    } catch (e) {
      res.errors.push({ row: rowIndex + 1, message: (e as Error).message });
    }
  };

  const siteRows = byType('site');
  if (siteRows.length) {
    const res: EntityResult = { type: 'site', created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < siteRows.length; i++) {
      const row = siteRows[i];
      await handleRow(async () => {
        if (!row['name']) throw new Error('"name" is required');
        if (siteMap.has(row['name'].toLowerCase())) {
          res.skipped++;
          return;
        }
        if (dryRun) {
          siteMap.set(row['name'].toLowerCase(), -1);
          res.created++;
        } else if (query && txSchema) {
          const s = await insertSiteTx(query, txSchema.site, organizationId, {
            name: row['name'],
            address: row['address'] || undefined,
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          siteMap.set(s.name.toLowerCase(), s.id);
          res.created++;
        } else {
          const s = await createSite({
            organizationId,
            name: row['name'],
            address: row['address'] || undefined,
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          siteMap.set(s.name.toLowerCase(), s.id);
          res.created++;
        }
      }, res, i);
    }
    results.push(res);
  }

  const bldRows = byType('building');
  if (bldRows.length) {
    const res: EntityResult = { type: 'building', created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < bldRows.length; i++) {
      const row = bldRows[i];
      await handleRow(async () => {
        if (!row['name']) throw new Error('"name" is required');
        const siteName = row['site_name'] ?? row['sitename'] ?? '';
        const siteId = siteMap.get(siteName.toLowerCase());
        if (!siteId) throw new Error(`Site "${siteName}" not found — create the site row first`);
        if (bldMap.has(row['name'].toLowerCase())) {
          res.skipped++;
          return;
        }
        if (dryRun) {
          bldMap.set(row['name'].toLowerCase(), -(res.created + 1));
          res.created++;
        } else if (query && txSchema) {
          const b = await insertBuildingTx(query, txSchema.buildingSiteColumn, {
            siteId,
            name: row['name'],
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          bldMap.set(b.name.toLowerCase(), b.id);
          res.created++;
        } else {
          const b = await createBuilding({
            siteId,
            name: row['name'],
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          bldMap.set(b.name.toLowerCase(), b.id);
          res.created++;
        }
      }, res, i);
    }
    results.push(res);
  }

  const floorRows = byType('floor');
  if (floorRows.length) {
    const res: EntityResult = { type: 'floor', created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < floorRows.length; i++) {
      const row = floorRows[i];
      await handleRow(async () => {
        if (!row['name']) throw new Error('"name" is required');
        const bName = row['building_name'] ?? row['buildingname'] ?? '';
        const buildingId = bldMap.get(bName.toLowerCase());
        if (!buildingId) throw new Error(`Building "${bName}" not found — create the building row first`);
        const fKey = `${bName.toLowerCase()}||${row['name'].toLowerCase()}`;
        if (floorMap.has(fKey)) {
          res.skipped++;
          return;
        }
        if (dryRun) {
          floorMap.set(fKey, -(res.created + 1));
          res.created++;
        } else if (query && txSchema) {
          const f = await insertFloorTx(query, {
            buildingId,
            name: row['name'],
            levelNo: parseNum(row['level_no'] ?? row['leveln'] ?? row['levelno'], 0),
          });
          floorMap.set(`${bName.toLowerCase()}||${f.name.toLowerCase()}`, f.id);
          res.created++;
        } else {
          const f = await createFloor({
            buildingId,
            name: row['name'],
            levelNo: parseNum(row['level_no'] ?? row['leveln'] ?? row['levelno'], 0),
          });
          floorMap.set(`${bName.toLowerCase()}||${f.name.toLowerCase()}`, f.id);
          res.created++;
        }
      }, res, i);
    }
    results.push(res);
  }

  const zoneRows = byType('zone');
  if (zoneRows.length) {
    const res: EntityResult = { type: 'zone', created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < zoneRows.length; i++) {
      const row = zoneRows[i];
      await handleRow(async () => {
        if (!row['name']) throw new Error('"name" is required');
        let floorId: number | undefined;
        const floorName = row['floor_name'] ?? row['floorname'] ?? '';
        if (floorName) {
          const bName = row['building_name'] ?? row['buildingname'] ?? '';
          const fKey = `${bName.toLowerCase()}||${floorName.toLowerCase()}`;
          floorId = floorMap.get(fKey) ?? floorMap.get(`||${floorName.toLowerCase()}`);
          if (!floorId) throw new Error(`Floor "${floorName}" not found — create the floor row first`);
        }
        if (zoneMap.has(row['name'].toLowerCase())) {
          res.skipped++;
          return;
        }
        const isRisk = parseBool(row['is_risk_zone'] ?? row['isriskzone'] ?? row['risk'], false);
        if (dryRun) {
          zoneMap.set(row['name'].toLowerCase(), -(res.created + 1));
          res.created++;
        } else if (query) {
          const z = await insertZoneTx(query, {
            floorId,
            name: row['name'],
            zoneType: row['zone_type'] ?? row['zonetype'] ?? 'General',
            isRiskZone: isRisk,
            riskCategory: (row['risk_category'] ?? row['riskcategory'] ?? '') || undefined,
            capacity: row['capacity'] ? parseNum(row['capacity']) : undefined,
          });
          zoneMap.set(z.name.toLowerCase(), z.id);
          res.created++;
        } else {
          const z = await createZone({
            floorId,
            name: row['name'],
            zoneType: row['zone_type'] ?? row['zonetype'] ?? 'General',
            isRiskZone: isRisk,
            riskCategory: (row['risk_category'] ?? row['riskcategory'] ?? '') as never || undefined,
            capacity: row['capacity'] ? parseNum(row['capacity']) : undefined,
          });
          zoneMap.set(z.name.toLowerCase(), z.id);
          res.created++;
        }
      }, res, i);
    }
    results.push(res);
  }

  const roomRows = byType('room');
  if (roomRows.length) {
    const res: EntityResult = { type: 'room', created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < roomRows.length; i++) {
      const row = roomRows[i];
      await handleRow(async () => {
        const code = row['room_code'] ?? row['roomcode'] ?? '';
        const name = row['room_name'] ?? row['roomname'] ?? '';
        if (!code) throw new Error('"room_code" is required');
        if (!name) throw new Error('"room_name" is required');
        let zoneId: number | undefined;
        const zoneName = row['zone_name'] ?? row['zonename'] ?? '';
        if (zoneName) {
          zoneId = zoneMap.get(zoneName.toLowerCase());
          if (!zoneId) throw new Error(`Zone "${zoneName}" not found — create the zone row first`);
        }
        if (dryRun) {
          res.created++;
        } else if (query) {
          await insertRoomTx(query, {
            zoneId,
            roomCode: code,
            roomName: name,
            roomType: row['room_type'] ?? row['roomtype'] ?? 'Classroom',
            capacity: parseNum(row['capacity'], 30),
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          res.created++;
        } else {
          await createRoom({
            zoneId,
            roomCode: code,
            roomName: name,
            roomType: row['room_type'] ?? row['roomtype'] ?? 'Classroom',
            capacity: parseNum(row['capacity'], 30),
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          res.created++;
        }
      }, res, i);
    }
    results.push(res);
  }

  const classRows = byType('class');
  if (classRows.length) {
    const res: EntityResult = { type: 'class', created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < classRows.length; i++) {
      const row = classRows[i];
      await handleRow(async () => {
        if (!row['name']) throw new Error('"name" is required');
        if (classMap.has(row['name'].toLowerCase())) {
          res.skipped++;
          return;
        }
        if (dryRun) {
          classMap.set(row['name'].toLowerCase(), -(res.created + 1));
          res.created++;
        } else if (query) {
          const c = await insertClassTx(query, organizationId, {
            name: row['name'],
            sortOrder: parseNum(row['sort_order'] ?? row['sortorder'], 0),
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          classMap.set(c.name.toLowerCase(), c.id);
          res.created++;
        } else {
          const c = await createClass({
            organizationId,
            name: row['name'],
            sortOrder: parseNum(row['sort_order'] ?? row['sortorder'], 0),
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          classMap.set(c.name.toLowerCase(), c.id);
          res.created++;
        }
      }, res, i);
    }
    results.push(res);
  }

  const sectionRows = byType('section');
  if (sectionRows.length) {
    const res: EntityResult = { type: 'section', created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < sectionRows.length; i++) {
      const row = sectionRows[i];
      await handleRow(async () => {
        if (!row['name']) throw new Error('"name" is required');
        const className = row['class_name'] ?? row['classname'] ?? '';
        const classId = classMap.get(className.toLowerCase());
        if (!classId) throw new Error(`Class "${className}" not found — create the class row first`);
        if (dryRun) {
          res.created++;
        } else if (query) {
          await insertSectionTx(query, {
            classId,
            name: row['name'],
            expectedStudentCount: parseNum(
              row['expected_student_count'] ?? row['expectedstudentcount'] ?? row['count'],
              30,
            ),
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          res.created++;
        } else {
          await createSection({
            classId,
            name: row['name'],
            expectedStudentCount: parseNum(
              row['expected_student_count'] ?? row['expectedstudentcount'] ?? row['count'],
              30,
            ),
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          res.created++;
        }
      }, res, i);
    }
    results.push(res);
  }

  const subjectRows = byType('subject');
  if (subjectRows.length) {
    const res: EntityResult = { type: 'subject', created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < subjectRows.length; i++) {
      const row = subjectRows[i];
      await handleRow(async () => {
        if (!row['name']) throw new Error('"name" is required');
        if (dryRun) {
          res.created++;
        } else if (query) {
          await insertSubjectTx(query, organizationId, {
            name: row['name'],
            subjectCode: (row['subject_code'] ?? row['subjectcode'] ?? '') || undefined,
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          res.created++;
        } else {
          await createSubject({
            organizationId,
            name: row['name'],
            subjectCode: (row['subject_code'] ?? row['subjectcode'] ?? '') || undefined,
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          res.created++;
        }
      }, res, i);
    }
    results.push(res);
  }

  const teacherRows = byType('teacher');
  if (teacherRows.length) {
    const res: EntityResult = { type: 'teacher', created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < teacherRows.length; i++) {
      const row = teacherRows[i];
      await handleRow(async () => {
        if (!row['name']) throw new Error('"name" is required');
        if (dryRun) {
          res.created++;
        } else if (query) {
          await insertTeacherTx(query, organizationId, {
            employeeCode: (row['employee_code'] ?? row['employeecode'] ?? '') || undefined,
            name: row['name'],
            email: row['email'] || undefined,
            phone: row['phone'] || undefined,
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          res.created++;
        } else {
          await createTeacher({
            organizationId,
            employeeCode: (row['employee_code'] ?? row['employeecode'] ?? '') || undefined,
            name: row['name'],
            email: row['email'] || undefined,
            phone: row['phone'] || undefined,
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          res.created++;
        }
      }, res, i);
    }
    results.push(res);
  }

  const staffRows = byType('staff');
  if (staffRows.length) {
    const res: EntityResult = { type: 'staff', created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < staffRows.length; i++) {
      const row = staffRows[i];
      await handleRow(async () => {
        if (!row['name']) throw new Error('"name" is required');
        if (dryRun) {
          res.created++;
        } else if (query) {
          await insertStaffTx(query, organizationId, {
            employeeCode: (row['employee_code'] ?? row['employeecode'] ?? '') || undefined,
            name: row['name'],
            role: row['role'] ?? 'Staff',
            phone: row['phone'] || undefined,
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          res.created++;
        } else {
          await createStaffMember({
            organizationId,
            employeeCode: (row['employee_code'] ?? row['employeecode'] ?? '') || undefined,
            name: row['name'],
            role: row['role'] ?? 'Staff',
            phone: row['phone'] || undefined,
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          res.created++;
        }
      }, res, i);
    }
    results.push(res);
  }

  const totalCreated = results.reduce((s, r) => s + r.created, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);
  const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);

  return { dryRun, totalCreated, totalErrors, totalSkipped, results };
}

/** Dry-run first; on commit with Postgres, all inserts run in one transaction. */
export async function commitMasterDataImport(
  organizationId: number,
  rows: ImportRow[],
): Promise<MasterDataImportResult> {
  const preview = await importMasterDataBulk(organizationId, rows, { dryRun: true });
  if (preview.totalErrors > 0) {
    return { ...preview, dryRun: false, committed: false, atomicAborted: true };
  }

  if (!isDbEnabled()) {
    return {
      ...(await importMasterDataBulk(organizationId, rows, { dryRun: true })),
      dryRun: false,
      committed: false,
      atomicAborted: true,
    };
  }

  const txSchema = await resolveTxSchema();
  const result = await withDbTransaction((query) =>
    importMasterDataBulk(organizationId, rows, { dryRun: false, query, txSchema }),
  );
  await refreshMasterDataCaches(organizationId);
  return { ...result, dryRun: false, committed: true };
}
