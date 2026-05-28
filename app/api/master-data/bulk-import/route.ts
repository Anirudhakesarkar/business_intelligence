import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';
import {
  createSite,
  createBuilding,
  createFloor,
  createZone,
  createRoom,
  createClass,
  createSection,
  createSubject,
  createTeacher,
  createStaffMember,
  listSites,
  listBuildings,
  listFloors,
  listZones,
  listClasses,
  DbDisabledError,
} from '@/lib/school-foundation/repos';

const ORG_ID = 1;

type ImportRow = Record<string, string>;

interface EntityResult {
  type: string;
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

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
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
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

function parseCSV(text: string): ImportRow[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const row: ImportRow = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? '').trim(); });
    return row;
  }).filter(r => r['type'] && r['type'].length > 0);
}

export async function POST(req: NextRequest) {
  try {
    await ensureFoundationHydrated();

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return err('No file uploaded. Send a multipart/form-data POST with field name "file".');

    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length === 0) return err('CSV has no data rows. Ensure it has a header row and at least one data row.');

    const siteMap = new Map<string, number>();
    const bldMap = new Map<string, number>();
    const floorMap = new Map<string, number>();
    const zoneMap = new Map<string, number>();
    const classMap = new Map<string, number>();

    for (const s of await listSites(ORG_ID)) siteMap.set(s.name.toLowerCase(), s.id);
    for (const b of await listBuildings()) bldMap.set(b.name.toLowerCase(), b.id);
    for (const f of await listFloors()) {
      const bName = (await listBuildings()).find(b => b.id === f.buildingId)?.name ?? '';
      floorMap.set(`${bName.toLowerCase()}||${f.name.toLowerCase()}`, f.id);
    }
    for (const z of await listZones()) zoneMap.set(z.name.toLowerCase(), z.id);
    for (const c of await listClasses(ORG_ID)) classMap.set(c.name.toLowerCase(), c.id);

    const byType = (t: string) => rows.filter(r => r['type']?.toLowerCase() === t);
    const results: EntityResult[] = [];

    const siteRows = byType('site');
    if (siteRows.length) {
      const res: EntityResult = { type: 'site', created: 0, skipped: 0, errors: [] };
      for (let i = 0; i < siteRows.length; i++) {
        const row = siteRows[i];
        try {
          if (!row['name']) throw new Error('"name" is required');
          if (siteMap.has(row['name'].toLowerCase())) { res.skipped++; continue; }
          const s = await createSite({
            organizationId: ORG_ID,
            name: row['name'],
            address: row['address'] || undefined,
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          siteMap.set(s.name.toLowerCase(), s.id);
          res.created++;
        } catch (e) { res.errors.push({ row: i + 1, message: (e as Error).message }); }
      }
      results.push(res);
    }

    const bldRows = byType('building');
    if (bldRows.length) {
      const res: EntityResult = { type: 'building', created: 0, skipped: 0, errors: [] };
      for (let i = 0; i < bldRows.length; i++) {
        const row = bldRows[i];
        try {
          if (!row['name']) throw new Error('"name" is required');
          const siteName = row['site_name'] ?? row['sitename'] ?? '';
          const siteId = siteMap.get(siteName.toLowerCase());
          if (!siteId) throw new Error(`Site "${siteName}" not found — create the site row first`);
          if (bldMap.has(row['name'].toLowerCase())) { res.skipped++; continue; }
          const b = await createBuilding({ siteId, name: row['name'], isActive: parseBool(row['is_active'] ?? row['isactive']) });
          bldMap.set(b.name.toLowerCase(), b.id);
          res.created++;
        } catch (e) { res.errors.push({ row: i + 1, message: (e as Error).message }); }
      }
      results.push(res);
    }

    const floorRows = byType('floor');
    if (floorRows.length) {
      const res: EntityResult = { type: 'floor', created: 0, skipped: 0, errors: [] };
      for (let i = 0; i < floorRows.length; i++) {
        const row = floorRows[i];
        try {
          if (!row['name']) throw new Error('"name" is required');
          const bName = row['building_name'] ?? row['buildingname'] ?? '';
          const buildingId = bldMap.get(bName.toLowerCase());
          if (!buildingId) throw new Error(`Building "${bName}" not found — create the building row first`);
          const fKey = `${bName.toLowerCase()}||${row['name'].toLowerCase()}`;
          if (floorMap.has(fKey)) { res.skipped++; continue; }
          const f = await createFloor({
            buildingId,
            name: row['name'],
            levelNo: parseNum(row['level_no'] ?? row['leveln'] ?? row['levelno'], 0),
          });
          floorMap.set(`${bName.toLowerCase()}||${f.name.toLowerCase()}`, f.id);
          res.created++;
        } catch (e) { res.errors.push({ row: i + 1, message: (e as Error).message }); }
      }
      results.push(res);
    }

    const zoneRows = byType('zone');
    if (zoneRows.length) {
      const res: EntityResult = { type: 'zone', created: 0, skipped: 0, errors: [] };
      for (let i = 0; i < zoneRows.length; i++) {
        const row = zoneRows[i];
        try {
          if (!row['name']) throw new Error('"name" is required');
          let floorId: number | undefined;
          const floorName = row['floor_name'] ?? row['floorname'] ?? '';
          if (floorName) {
            const bName = row['building_name'] ?? row['buildingname'] ?? '';
            const fKey = `${bName.toLowerCase()}||${floorName.toLowerCase()}`;
            floorId = floorMap.get(fKey) ?? floorMap.get(`||${floorName.toLowerCase()}`);
            if (!floorId) throw new Error(`Floor "${floorName}" not found — create the floor row first`);
          }
          if (zoneMap.has(row['name'].toLowerCase())) { res.skipped++; continue; }
          const isRisk = parseBool(row['is_risk_zone'] ?? row['isriskzone'] ?? row['risk'], false);
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
        } catch (e) { res.errors.push({ row: i + 1, message: (e as Error).message }); }
      }
      results.push(res);
    }

    const roomRows = byType('room');
    if (roomRows.length) {
      const res: EntityResult = { type: 'room', created: 0, skipped: 0, errors: [] };
      for (let i = 0; i < roomRows.length; i++) {
        const row = roomRows[i];
        try {
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
          await createRoom({
            zoneId,
            roomCode: code,
            roomName: name,
            roomType: row['room_type'] ?? row['roomtype'] ?? 'Classroom',
            capacity: parseNum(row['capacity'], 30),
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          res.created++;
        } catch (e) { res.errors.push({ row: i + 1, message: (e as Error).message }); }
      }
      results.push(res);
    }

    const classRows = byType('class');
    if (classRows.length) {
      const res: EntityResult = { type: 'class', created: 0, skipped: 0, errors: [] };
      for (let i = 0; i < classRows.length; i++) {
        const row = classRows[i];
        try {
          if (!row['name']) throw new Error('"name" is required');
          if (classMap.has(row['name'].toLowerCase())) { res.skipped++; continue; }
          const c = await createClass({
            organizationId: ORG_ID,
            name: row['name'],
            sortOrder: parseNum(row['sort_order'] ?? row['sortorder'], 0),
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          classMap.set(c.name.toLowerCase(), c.id);
          res.created++;
        } catch (e) { res.errors.push({ row: i + 1, message: (e as Error).message }); }
      }
      results.push(res);
    }

    const sectionRows = byType('section');
    if (sectionRows.length) {
      const res: EntityResult = { type: 'section', created: 0, skipped: 0, errors: [] };
      for (let i = 0; i < sectionRows.length; i++) {
        const row = sectionRows[i];
        try {
          if (!row['name']) throw new Error('"name" is required');
          const className = row['class_name'] ?? row['classname'] ?? '';
          const classId = classMap.get(className.toLowerCase());
          if (!classId) throw new Error(`Class "${className}" not found — create the class row first`);
          await createSection({
            classId,
            name: row['name'],
            expectedStudentCount: parseNum(row['expected_student_count'] ?? row['expectedstudentcount'] ?? row['count'], 30),
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          res.created++;
        } catch (e) { res.errors.push({ row: i + 1, message: (e as Error).message }); }
      }
      results.push(res);
    }

    const subjectRows = byType('subject');
    if (subjectRows.length) {
      const res: EntityResult = { type: 'subject', created: 0, skipped: 0, errors: [] };
      for (let i = 0; i < subjectRows.length; i++) {
        const row = subjectRows[i];
        try {
          if (!row['name']) throw new Error('"name" is required');
          await createSubject({
            organizationId: ORG_ID,
            name: row['name'],
            subjectCode: (row['subject_code'] ?? row['subjectcode'] ?? '') || undefined,
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          res.created++;
        } catch (e) { res.errors.push({ row: i + 1, message: (e as Error).message }); }
      }
      results.push(res);
    }

    const teacherRows = byType('teacher');
    if (teacherRows.length) {
      const res: EntityResult = { type: 'teacher', created: 0, skipped: 0, errors: [] };
      for (let i = 0; i < teacherRows.length; i++) {
        const row = teacherRows[i];
        try {
          if (!row['name']) throw new Error('"name" is required');
          await createTeacher({
            organizationId: ORG_ID,
            employeeCode: (row['employee_code'] ?? row['employeecode'] ?? '') || undefined,
            name: row['name'],
            email: row['email'] || undefined,
            phone: row['phone'] || undefined,
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          res.created++;
        } catch (e) { res.errors.push({ row: i + 1, message: (e as Error).message }); }
      }
      results.push(res);
    }

    const staffRows = byType('staff');
    if (staffRows.length) {
      const res: EntityResult = { type: 'staff', created: 0, skipped: 0, errors: [] };
      for (let i = 0; i < staffRows.length; i++) {
        const row = staffRows[i];
        try {
          if (!row['name']) throw new Error('"name" is required');
          await createStaffMember({
            organizationId: ORG_ID,
            employeeCode: (row['employee_code'] ?? row['employeecode'] ?? '') || undefined,
            name: row['name'],
            role: row['role'] ?? 'Staff',
            phone: row['phone'] || undefined,
            isActive: parseBool(row['is_active'] ?? row['isactive']),
          });
          res.created++;
        } catch (e) { res.errors.push({ row: i + 1, message: (e as Error).message }); }
      }
      results.push(res);
    }

    const totalCreated = results.reduce((s, r) => s + r.created, 0);
    const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);
    const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);

    return json({ ok: true, totalCreated, totalErrors, totalSkipped, results });
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message, 500);
  }
}
