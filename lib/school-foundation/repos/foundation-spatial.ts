import type { Building, Floor, Room, Zone } from '../types';
import { orgIdFromPg, resolveOrgIdForPg } from '../../school-db/organization-id';
import { db as memDb, logAudit, _ensureNextIdAbove } from '../store';
import { columnExists, dbQuery, isDbEnabled, num, requirePool, tableExists } from './shared';

let buildingSiteColumnCache: 'site_id' | 'campus_id' | null = null;
async function resolveBuildingSiteColumn(): Promise<'site_id' | 'campus_id'> {
  if (buildingSiteColumnCache) return buildingSiteColumnCache;
  if (await columnExists('school_buildings', 'site_id')) {
    buildingSiteColumnCache = 'site_id';
    return buildingSiteColumnCache;
  }
  buildingSiteColumnCache = 'campus_id';
  return buildingSiteColumnCache;
}

let siteTableCache: 'school_sites' | 'school_campuses' | null = null;
async function resolveSiteTable(): Promise<'school_sites' | 'school_campuses'> {
  if (siteTableCache) return siteTableCache;
  siteTableCache = (await tableExists('school_sites')) ? 'school_sites' : 'school_campuses';
  return siteTableCache;
}

// ─── Buildings ───────────────────────────────────────────────────────────────

type BuildingRow = { id: string | number; site_id: string | number; name: string; is_active: boolean };

function buildingFromRow(r: BuildingRow): Building {
  return { id: num(r.id), siteId: num(r.site_id), name: r.name, isActive: r.is_active };
}

function mirrorBuilding(row: Building) {
  const arr = memDb.buildings();
  const i = arr.findIndex((b) => b.id === row.id);
  if (i >= 0) arr[i] = row;
  else arr.push(row);
  _ensureNextIdAbove(row.id);
}

async function getBuildingById(id: number): Promise<Building | null> {
  const siteColumn = await resolveBuildingSiteColumn();
  const r = await dbQuery<BuildingRow>(
    `SELECT id, ${siteColumn} AS site_id, name, is_active FROM school_buildings WHERE id = $1`,
    [id],
  );
  return r?.rows[0] ? buildingFromRow(r.rows[0]) : null;
}

export async function listBuildings(siteId?: number): Promise<Building[]> {
  if (!isDbEnabled()) {
    if (siteId == null) return [...memDb.buildings()];
    return memDb.buildings().filter((b) => b.siteId === siteId);
  }
  requirePool();
  const siteColumn = await resolveBuildingSiteColumn();
  const sql = siteId
    ? `SELECT id, ${siteColumn} AS site_id, name, is_active FROM school_buildings WHERE ${siteColumn} = $1 ORDER BY id`
    : `SELECT id, ${siteColumn} AS site_id, name, is_active FROM school_buildings ORDER BY id`;
  const params = siteId ? [siteId] : [];
  const r = await dbQuery<BuildingRow>(sql, params);
  const rows = (r?.rows ?? []).map(buildingFromRow);
  for (const row of rows) mirrorBuilding(row);
  return rows;
}

export async function createBuilding(input: Omit<Building, 'id'>): Promise<Building> {
  requirePool();
  const siteColumn = await resolveBuildingSiteColumn();
  const r = await dbQuery<BuildingRow>(
    `INSERT INTO school_buildings (${siteColumn}, name, is_active) VALUES ($1, $2, $3)
     RETURNING id, ${siteColumn} AS site_id, name, is_active`,
    [input.siteId, input.name.trim(), input.isActive ?? true],
  );
  if (!r?.rows[0]) throw new Error('Failed to create building');
  const row = buildingFromRow(r.rows[0]);
  mirrorBuilding(row);
  logAudit('create', 'building', row.id, row);
  return row;
}

export type PatchBuildingInput = Partial<Pick<Building, 'siteId' | 'name' | 'isActive'>>;

export async function patchBuilding(id: number, patch: PatchBuildingInput): Promise<Building> {
  requirePool();
  const siteColumn = await resolveBuildingSiteColumn();
  if (patch.name !== undefined && !String(patch.name).trim()) throw new Error('Name required');
  const before = await getBuildingById(id);
  if (!before) throw new Error('Building not found');

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (patch.siteId !== undefined) {
    sets.push(`${siteColumn} = $${idx++}`);
    params.push(patch.siteId);
  }
  if (patch.name !== undefined) {
    sets.push(`name = $${idx++}`);
    params.push(patch.name.trim());
  }
  if (patch.isActive !== undefined) {
    sets.push(`is_active = $${idx++}`);
    params.push(patch.isActive);
  }
  if (!sets.length) return before;
  params.push(id);

  const r = await dbQuery<BuildingRow>(
    `UPDATE school_buildings SET ${sets.join(', ')} WHERE id = $${idx}
     RETURNING id, ${siteColumn} AS site_id, name, is_active`,
    params,
  );
  if (!r?.rows[0]) throw new Error('Building not found');
  const row = buildingFromRow(r.rows[0]);
  mirrorBuilding(row);
  logAudit('update', 'building', id, row, before);
  return row;
}

export async function deleteBuilding(id: number): Promise<{ ok: true }> {
  requirePool();
  const before = (await listBuildings()).find((b) => b.id === id);
  if (!before) throw new Error('Building not found');
  await dbQuery(`DELETE FROM school_buildings WHERE id = $1`, [id]);
  const arr = memDb.buildings();
  const i = arr.findIndex((b) => b.id === id);
  if (i >= 0) arr.splice(i, 1);
  logAudit('delete', 'building', id, undefined, before);
  return { ok: true };
}

export async function hydrateBuildingsFromPg(): Promise<{ hydrated: number }> {
  const rows = await listBuildings();
  return { hydrated: rows.length };
}

// ─── Floors ──────────────────────────────────────────────────────────────────

type FloorRow = { id: string | number; building_id: string | number; name: string; level_no: number };

function floorFromRow(r: FloorRow): Floor {
  return { id: num(r.id), buildingId: num(r.building_id), name: r.name, levelNo: r.level_no };
}

function mirrorFloor(row: Floor) {
  const arr = memDb.floors();
  const i = arr.findIndex((f) => f.id === row.id);
  if (i >= 0) arr[i] = row;
  else arr.push(row);
  _ensureNextIdAbove(row.id);
}

async function getFloorById(id: number): Promise<Floor | null> {
  const r = await dbQuery<FloorRow>(
    `SELECT id, building_id, name, level_no FROM school_floors WHERE id = $1`,
    [id],
  );
  return r?.rows[0] ? floorFromRow(r.rows[0]) : null;
}

export async function listFloors(buildingId?: number): Promise<Floor[]> {
  if (!isDbEnabled()) {
    if (buildingId == null) return [...memDb.floors()];
    return memDb.floors().filter((f) => f.buildingId === buildingId);
  }
  requirePool();
  const sql = buildingId
    ? `SELECT id, building_id, name, level_no FROM school_floors WHERE building_id = $1 ORDER BY id`
    : `SELECT id, building_id, name, level_no FROM school_floors ORDER BY id`;
  const params = buildingId ? [buildingId] : [];
  const r = await dbQuery<FloorRow>(sql, params);
  const rows = (r?.rows ?? []).map(floorFromRow);
  for (const row of rows) mirrorFloor(row);
  return rows;
}

export async function createFloor(input: Omit<Floor, 'id'>): Promise<Floor> {
  requirePool();
  const r = await dbQuery<FloorRow>(
    `INSERT INTO school_floors (building_id, name, level_no) VALUES ($1, $2, $3)
     RETURNING id, building_id, name, level_no`,
    [input.buildingId, input.name.trim(), input.levelNo ?? 0],
  );
  if (!r?.rows[0]) throw new Error('Failed to create floor');
  const row = floorFromRow(r.rows[0]);
  mirrorFloor(row);
  logAudit('create', 'floor', row.id, row);
  return row;
}

export type PatchFloorInput = Partial<Pick<Floor, 'buildingId' | 'name' | 'levelNo'>>;

export async function patchFloor(id: number, patch: PatchFloorInput): Promise<Floor> {
  requirePool();
  if (patch.name !== undefined && !String(patch.name).trim()) throw new Error('Name required');
  const before = await getFloorById(id);
  if (!before) throw new Error('Floor not found');

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (patch.buildingId !== undefined) {
    sets.push(`building_id = $${idx++}`);
    params.push(patch.buildingId);
  }
  if (patch.name !== undefined) {
    sets.push(`name = $${idx++}`);
    params.push(patch.name.trim());
  }
  if (patch.levelNo !== undefined) {
    sets.push(`level_no = $${idx++}`);
    params.push(patch.levelNo);
  }
  if (!sets.length) return before;
  params.push(id);

  const r = await dbQuery<FloorRow>(
    `UPDATE school_floors SET ${sets.join(', ')} WHERE id = $${idx}
     RETURNING id, building_id, name, level_no`,
    params,
  );
  if (!r?.rows[0]) throw new Error('Floor not found');
  const row = floorFromRow(r.rows[0]);
  mirrorFloor(row);
  logAudit('update', 'floor', id, row, before);
  return row;
}

export async function deleteFloor(id: number): Promise<{ ok: true }> {
  requirePool();
  const before = (await listFloors()).find((f) => f.id === id);
  if (!before) throw new Error('Floor not found');
  await dbQuery(`DELETE FROM school_floors WHERE id = $1`, [id]);
  const arr = memDb.floors();
  const i = arr.findIndex((f) => f.id === id);
  if (i >= 0) arr.splice(i, 1);
  logAudit('delete', 'floor', id, undefined, before);
  return { ok: true };
}

export async function hydrateFloorsFromPg(): Promise<{ hydrated: number }> {
  const rows = await listFloors();
  return { hydrated: rows.length };
}

// ─── Zones ───────────────────────────────────────────────────────────────────

type ZoneRow = {
  id: string | number;
  floor_id: string | number | null;
  name: string;
  zone_type: string;
  is_risk_zone: boolean;
  risk_category: string | null;
  capacity: number | null;
};

function zoneFromRow(r: ZoneRow): Zone {
  return {
    id: num(r.id),
    floorId: r.floor_id != null ? num(r.floor_id) : undefined,
    name: r.name,
    zoneType: r.zone_type,
    isRiskZone: r.is_risk_zone,
    riskCategory: (r.risk_category as Zone['riskCategory']) ?? undefined,
    capacity: r.capacity ?? undefined,
  };
}

function mirrorZone(row: Zone) {
  const arr = memDb.zones();
  if (!arr.some((z) => z.id === row.id)) arr.push(row);
  _ensureNextIdAbove(row.id);
}

async function getZoneById(id: number): Promise<Zone | null> {
  const r = await dbQuery<ZoneRow>(
    `SELECT id, floor_id, name, zone_type, is_risk_zone, risk_category, capacity
     FROM school_zones WHERE id = $1`,
    [id],
  );
  return r?.rows[0] ? zoneFromRow(r.rows[0]) : null;
}

export async function listZones(floorId?: number): Promise<Zone[]> {
  if (!isDbEnabled()) {
    if (floorId == null) return [...memDb.zones()];
    return memDb.zones().filter((z) => z.floorId === floorId);
  }
  requirePool();
  const sql = floorId
    ? `SELECT id, floor_id, name, zone_type, is_risk_zone, risk_category, capacity
       FROM school_zones WHERE floor_id = $1 ORDER BY id`
    : `SELECT id, floor_id, name, zone_type, is_risk_zone, risk_category, capacity FROM school_zones ORDER BY id`;
  const params = floorId ? [floorId] : [];
  const r = await dbQuery<ZoneRow>(sql, params);
  const rows = (r?.rows ?? []).map(zoneFromRow);
  for (const row of rows) mirrorZone(row);
  return rows;
}

export async function createZone(input: Omit<Zone, 'id'>): Promise<Zone> {
  requirePool();
  const r = await dbQuery<ZoneRow>(
    `INSERT INTO school_zones (floor_id, name, zone_type, is_risk_zone, risk_category, capacity)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, floor_id, name, zone_type, is_risk_zone, risk_category, capacity`,
    [
      input.floorId ?? null,
      input.name.trim(),
      input.zoneType ?? 'General',
      input.isRiskZone ?? false,
      input.riskCategory ?? null,
      input.capacity ?? null,
    ],
  );
  if (!r?.rows[0]) throw new Error('Failed to create zone');
  const row = zoneFromRow(r.rows[0]);
  mirrorZone(row);
  logAudit('create', 'zone', row.id, row);
  return row;
}

export type PatchZoneInput = Partial<
  Pick<Zone, 'floorId' | 'name' | 'zoneType' | 'isRiskZone' | 'riskCategory' | 'capacity'>
>;

export async function patchZone(id: number, patch: PatchZoneInput): Promise<Zone> {
  requirePool();
  if (patch.name !== undefined && !String(patch.name).trim()) throw new Error('Name required');
  const before = await getZoneById(id);
  if (!before) throw new Error('Zone not found');

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (patch.floorId !== undefined) {
    sets.push(`floor_id = $${idx++}`);
    params.push(patch.floorId ?? null);
  }
  if (patch.name !== undefined) {
    sets.push(`name = $${idx++}`);
    params.push(patch.name.trim());
  }
  if (patch.zoneType !== undefined) {
    sets.push(`zone_type = $${idx++}`);
    params.push(patch.zoneType);
  }
  if (patch.isRiskZone !== undefined) {
    sets.push(`is_risk_zone = $${idx++}`);
    params.push(patch.isRiskZone);
  }
  if (patch.isRiskZone === false) {
    sets.push(`risk_category = $${idx++}`);
    params.push(null);
  } else if (patch.riskCategory !== undefined) {
    sets.push(`risk_category = $${idx++}`);
    params.push(patch.riskCategory ?? null);
  }
  if (patch.capacity !== undefined) {
    sets.push(`capacity = $${idx++}`);
    params.push(patch.capacity ?? null);
  }
  if (!sets.length) return before;
  params.push(id);

  const r = await dbQuery<ZoneRow>(
    `UPDATE school_zones SET ${sets.join(', ')} WHERE id = $${idx}
     RETURNING id, floor_id, name, zone_type, is_risk_zone, risk_category, capacity`,
    params,
  );
  if (!r?.rows[0]) throw new Error('Zone not found');
  const row = zoneFromRow(r.rows[0]);
  mirrorZone(row);
  logAudit('update', 'zone', id, row, before);
  return row;
}

export async function deleteZone(id: number): Promise<{ ok: true }> {
  requirePool();
  const zones = memDb.zones();
  const row = zones.find((z) => z.id === id);
  if (!row) {
    const listed = await listZones();
    if (!listed.find((z) => z.id === id)) throw new Error('Zone not found');
  }

  const roomIds = await dbQuery<{ id: string }>(`SELECT id FROM school_rooms WHERE zone_id = $1`, [id]);
  for (const r of roomIds?.rows ?? []) {
    await deleteRoom(num(r.id));
  }

  await dbQuery(`DELETE FROM school_staff_duty_rosters WHERE zone_id = $1`, [id]);
  await dbQuery(`UPDATE school_mgmt_cameras SET zone_id = NULL WHERE zone_id = $1`, [id]);

  const rosters = memDb.rosters();
  for (let i = rosters.length - 1; i >= 0; i--) {
    if (rosters[i].zoneId === id) rosters.splice(i, 1);
  }
  for (const cam of memDb.cameras()) {
    if (cam.zoneId === id) cam.zoneId = undefined;
  }

  await dbQuery(`DELETE FROM school_zones WHERE id = $1`, [id]);
  const zi = zones.findIndex((z) => z.id === id);
  if (zi >= 0) zones.splice(zi, 1);
  logAudit('delete', 'zone', id, undefined, row);
  return { ok: true };
}

export async function hydrateZonesFromPg(): Promise<{ hydrated: number }> {
  const rows = await listZones();
  return { hydrated: rows.length };
}

// ─── Rooms ───────────────────────────────────────────────────────────────────

type RoomRow = {
  id: string | number;
  zone_id: string | number | null;
  room_code: string;
  room_name: string;
  room_type: string;
  capacity: number;
  is_active: boolean;
};

function roomFromRow(r: RoomRow): Room {
  return {
    id: num(r.id),
    zoneId: r.zone_id != null ? num(r.zone_id) : undefined,
    roomCode: r.room_code,
    roomName: r.room_name,
    roomType: r.room_type,
    capacity: r.capacity,
    isActive: r.is_active,
  };
}

function mirrorRoom(row: Room) {
  const arr = memDb.rooms();
  const i = arr.findIndex((r) => r.id === row.id);
  if (i >= 0) arr[i] = row;
  else arr.push(row);
  _ensureNextIdAbove(row.id);
}

async function getRoomById(id: number): Promise<Room | null> {
  const r = await dbQuery<RoomRow>(
    `SELECT id, zone_id, room_code, room_name, room_type, capacity, is_active FROM school_rooms WHERE id = $1`,
    [id],
  );
  return r?.rows[0] ? roomFromRow(r.rows[0]) : null;
}

export async function listRooms(organizationId?: number | string): Promise<Room[]> {
  if (!isDbEnabled()) {
    if (organizationId == null) return [...memDb.rooms()];
    const org = Number(organizationId);
    const siteIds = memDb.sites().filter((s) => s.organizationId === org).map((s) => s.id);
    const buildingIds = memDb.buildings().filter((b) => siteIds.includes(b.siteId)).map((b) => b.id);
    const floorIds = memDb.floors().filter((f) => buildingIds.includes(f.buildingId)).map((f) => f.id);
    const zoneIds = memDb.zones().filter((z) => z.floorId != null && floorIds.includes(z.floorId)).map((z) => z.id);
    return memDb.rooms().filter((r) => r.zoneId != null && zoneIds.includes(r.zoneId));
  }
  requirePool();
  if (organizationId === undefined) {
    const r = await dbQuery<RoomRow>(
      `SELECT id, zone_id, room_code, room_name, room_type, capacity, is_active FROM school_rooms ORDER BY id`,
    );
    const rows = (r?.rows ?? []).map(roomFromRow);
    for (const row of rows) mirrorRoom(row);
    return rows;
  }
  const pgOrgId = resolveOrgIdForPg(organizationId);
  const siteTable = await resolveSiteTable();
  const siteColumn = await resolveBuildingSiteColumn();
  const r = await dbQuery<RoomRow>(
    `SELECT DISTINCT r.id, r.zone_id, r.room_code, r.room_name, r.room_type, r.capacity, r.is_active
     FROM school_rooms r
     JOIN school_zones z ON z.id = r.zone_id
     JOIN school_floors f ON f.id = z.floor_id
     JOIN school_buildings b ON b.id = f.building_id
     JOIN ${siteTable} s ON s.id = b.${siteColumn}
     WHERE s.organization_id = $1
     ORDER BY r.id`,
    [pgOrgId],
  );
  const rows = (r?.rows ?? []).map(roomFromRow);
  for (const row of rows) mirrorRoom(row);
  return rows;
}

export async function createRoom(input: Omit<Room, 'id'>): Promise<Room> {
  requirePool();
  if (input.capacity < 1) throw new Error('Room capacity must be at least 1.');
  const r = await dbQuery<RoomRow>(
    `INSERT INTO school_rooms (zone_id, room_code, room_name, room_type, capacity, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, zone_id, room_code, room_name, room_type, capacity, is_active`,
    [
      input.zoneId ?? null,
      input.roomCode.trim(),
      input.roomName.trim(),
      input.roomType ?? 'Classroom',
      input.capacity,
      input.isActive ?? true,
    ],
  );
  if (!r?.rows[0]) throw new Error('Failed to create room');
  const row = roomFromRow(r.rows[0]);
  mirrorRoom(row);
  logAudit('create', 'room', row.id, row);
  return row;
}

export type PatchRoomInput = Partial<
  Pick<Room, 'zoneId' | 'roomCode' | 'roomName' | 'roomType' | 'capacity' | 'isActive'>
>;

export async function patchRoom(id: number, patch: PatchRoomInput): Promise<Room> {
  requirePool();
  if (patch.roomCode !== undefined && !String(patch.roomCode).trim()) throw new Error('Room code required');
  if (patch.roomName !== undefined && !String(patch.roomName).trim()) throw new Error('Room name required');
  if (patch.capacity !== undefined && patch.capacity < 1) {
    throw new Error('Room capacity must be at least 1.');
  }
  const before = await getRoomById(id);
  if (!before) throw new Error('Room not found');

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (patch.zoneId !== undefined) {
    sets.push(`zone_id = $${idx++}`);
    params.push(patch.zoneId ?? null);
  }
  if (patch.roomCode !== undefined) {
    sets.push(`room_code = $${idx++}`);
    params.push(patch.roomCode.trim());
  }
  if (patch.roomName !== undefined) {
    sets.push(`room_name = $${idx++}`);
    params.push(patch.roomName.trim());
  }
  if (patch.roomType !== undefined) {
    sets.push(`room_type = $${idx++}`);
    params.push(patch.roomType);
  }
  if (patch.capacity !== undefined) {
    sets.push(`capacity = $${idx++}`);
    params.push(patch.capacity);
  }
  if (patch.isActive !== undefined) {
    sets.push(`is_active = $${idx++}`);
    params.push(patch.isActive);
  }
  if (!sets.length) return before;
  params.push(id);

  const r = await dbQuery<RoomRow>(
    `UPDATE school_rooms SET ${sets.join(', ')} WHERE id = $${idx}
     RETURNING id, zone_id, room_code, room_name, room_type, capacity, is_active`,
    params,
  );
  if (!r?.rows[0]) throw new Error('Room not found');
  const row = roomFromRow(r.rows[0]);
  mirrorRoom(row);
  logAudit('update', 'room', id, row, before);
  return row;
}

export async function deleteRoom(id: number): Promise<{ ok: true }> {
  requirePool();
  const before = memDb.rooms().find((r) => r.id === id);
  if (!before) {
    const listed = await listRooms();
    if (!listed.find((r) => r.id === id)) throw new Error('Room not found');
  }

  // Timetable and cameras reference rooms (FK). Clear dependents before DELETE — same as store.ts deleteRoom.
  await dbQuery(`DELETE FROM school_timetable_entries WHERE room_id = $1`, [id]);
  await dbQuery(`UPDATE school_mgmt_cameras SET room_id = NULL WHERE room_id = $1`, [id]);

  const timetable = memDb.timetable();
  for (let i = timetable.length - 1; i >= 0; i--) {
    if (timetable[i].roomId === id) timetable.splice(i, 1);
  }
  for (const cam of memDb.cameras()) {
    if (cam.roomId === id) cam.roomId = undefined;
  }
  const mappings = memDb.sectionRoomMappings();
  for (let i = mappings.length - 1; i >= 0; i--) {
    if (mappings[i].roomId === id) mappings.splice(i, 1);
  }

  await dbQuery(`DELETE FROM school_rooms WHERE id = $1`, [id]);
  const arr = memDb.rooms();
  const i = arr.findIndex((r) => r.id === id);
  if (i >= 0) arr.splice(i, 1);
  logAudit('delete', 'room', id, undefined, before);
  return { ok: true };
}

export async function hydrateRoomsFromPg(): Promise<{ hydrated: number }> {
  const rows = await listRooms();
  return { hydrated: rows.length };
}
