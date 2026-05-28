import { db as memDb } from '../store';
import { dbQuery, isDbEnabled, num, requirePool, tableExists, columnExists, withDbTransaction } from './shared';

export type OrphanSpatialCounts = {
  orphanZones: number;
  orphanRooms: number;
  total: number;
};

export type OrphanSpatialCleanupResult = {
  dryRun: boolean;
  counts: OrphanSpatialCounts;
  deleted?: OrphanSpatialCounts;
};

async function resolveSiteTable(): Promise<'school_sites' | 'school_campuses' | null> {
  if (await tableExists('school_sites')) return 'school_sites';
  if (await tableExists('school_campuses')) return 'school_campuses';
  return null;
}

async function resolveBuildingSiteColumn(): Promise<'site_id' | 'campus_id' | null> {
  if (!(await tableExists('school_buildings'))) return null;
  if (await columnExists('school_buildings', 'site_id')) return 'site_id';
  if (await columnExists('school_buildings', 'campus_id')) return 'campus_id';
  return null;
}

/** SQL fragment: zone id is linked through campus → building → floor. */
function linkedZoneExistsSql(zoneIdExpr: string, siteTable: string, siteColumn: string) {
  return `EXISTS (
    SELECT 1 FROM school_zones lz
    JOIN school_floors f ON f.id = lz.floor_id
    JOIN school_buildings b ON b.id = f.building_id
    JOIN ${siteTable} s ON s.id = b.${siteColumn}
    WHERE lz.id = ${zoneIdExpr}
  )`;
}

function countOrphanSpatialMemory(): OrphanSpatialCounts {
  const siteIds = new Set(memDb.sites().map((s) => s.id));
  const buildingIds = new Set(memDb.buildings().filter((b) => siteIds.has(b.siteId)).map((b) => b.id));
  const floorIds = new Set(memDb.floors().filter((f) => buildingIds.has(f.buildingId)).map((f) => f.id));
  const linkedZoneIds = new Set(
    memDb.zones().filter((z) => z.floorId != null && floorIds.has(z.floorId)).map((z) => z.id),
  );
  const orphanZones = memDb.zones().filter((z) => !z.floorId || !floorIds.has(z.floorId)).length;
  const orphanRooms = memDb.rooms().filter((r) => !r.zoneId || !linkedZoneIds.has(r.zoneId)).length;
  return { orphanZones, orphanRooms, total: orphanZones + orphanRooms };
}

export async function countOrphanSpatialRows(): Promise<OrphanSpatialCounts> {
  if (!isDbEnabled()) return countOrphanSpatialMemory();
  requirePool();
  const siteTable = await resolveSiteTable();
  const siteColumn = await resolveBuildingSiteColumn();
  if (!siteTable || !siteColumn) return { orphanZones: 0, orphanRooms: 0, total: 0 };

  const linked = linkedZoneExistsSql('z.id', siteTable, siteColumn);
  const zoneRes = await dbQuery<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM school_zones z
     WHERE z.floor_id IS NULL OR NOT ${linked}`,
  );
  const roomRes = await dbQuery<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM school_rooms r
     WHERE r.zone_id IS NULL OR NOT ${linkedZoneExistsSql('r.zone_id', siteTable, siteColumn)}`,
  );
  const orphanZones = Number(zoneRes?.rows[0]?.count ?? 0);
  const orphanRooms = Number(roomRes?.rows[0]?.count ?? 0);
  return { orphanZones, orphanRooms, total: orphanZones + orphanRooms };
}

function purgeOrphanSpatialFromMem(zoneIds: number[], roomIds: number[]) {
  const zSet = new Set(zoneIds);
  const rSet = new Set(roomIds);
  for (const cam of memDb.cameras()) {
    if (cam.zoneId != null && zSet.has(cam.zoneId)) cam.zoneId = undefined;
  }
  const timetable = memDb.timetable();
  for (let i = timetable.length - 1; i >= 0; i--) {
    if (timetable[i].roomId != null && rSet.has(timetable[i].roomId)) timetable.splice(i, 1);
  }
  const rooms = memDb.rooms();
  for (let i = rooms.length - 1; i >= 0; i--) {
    if (rSet.has(rooms[i].id)) rooms.splice(i, 1);
  }
  const zones = memDb.zones();
  for (let i = zones.length - 1; i >= 0; i--) {
    if (zSet.has(zones[i].id)) zones.splice(i, 1);
  }
}

export async function removeOrphanSpatialRows(opts: {
  dryRun: boolean;
}): Promise<OrphanSpatialCleanupResult> {
  const counts = await countOrphanSpatialRows();
  if (opts.dryRun || counts.total === 0) {
    return { dryRun: true, counts };
  }

  if (!isDbEnabled()) {
    const siteIds = new Set(memDb.sites().map((s) => s.id));
    const buildingIds = new Set(memDb.buildings().filter((b) => siteIds.has(b.siteId)).map((b) => b.id));
    const floorIds = new Set(memDb.floors().filter((f) => buildingIds.has(f.buildingId)).map((f) => f.id));
    const zoneIds = memDb.zones().filter((z) => !z.floorId || !floorIds.has(z.floorId)).map((z) => z.id);
    const linkedZoneIds = new Set(
      memDb.zones().filter((z) => z.floorId != null && floorIds.has(z.floorId)).map((z) => z.id),
    );
    const roomIds = memDb.rooms().filter((r) => !r.zoneId || !linkedZoneIds.has(r.zoneId)).map((r) => r.id);
    purgeOrphanSpatialFromMem(zoneIds, roomIds);
    return {
      dryRun: false,
      counts,
      deleted: { orphanZones: zoneIds.length, orphanRooms: roomIds.length, total: zoneIds.length + roomIds.length },
    };
  }

  requirePool();
  const siteTable = await resolveSiteTable();
  const siteColumn = await resolveBuildingSiteColumn();
  if (!siteTable || !siteColumn) {
    return { dryRun: false, counts, deleted: { orphanZones: 0, orphanRooms: 0, total: 0 } };
  }

  const linkedZ = linkedZoneExistsSql('z.id', siteTable, siteColumn);
  const linkedR = linkedZoneExistsSql('r.zone_id', siteTable, siteColumn);

  const orphanZoneRows = await dbQuery<{ id: string }>(
    `SELECT z.id FROM school_zones z WHERE z.floor_id IS NULL OR NOT ${linkedZ}`,
  );
  const orphanRoomRows = await dbQuery<{ id: string }>(
    `SELECT r.id FROM school_rooms r WHERE r.zone_id IS NULL OR NOT ${linkedR}`,
  );
  const zoneIds = (orphanZoneRows?.rows ?? []).map((r) => num(r.id));
  const roomIds = (orphanRoomRows?.rows ?? []).map((r) => num(r.id));

  let deleted = { orphanRooms: 0, orphanZones: 0, total: 0 };
  await withDbTransaction(async (query) => {
    if (zoneIds.length) {
      await query(`UPDATE school_mgmt_cameras SET zone_id = NULL WHERE zone_id = ANY($1::bigint[])`, [zoneIds]);
    }
    if (roomIds.length) {
      await query(`DELETE FROM school_timetable_entries WHERE room_id = ANY($1::bigint[])`, [roomIds]);
    }
    const roomDel = await query<{ count: string }>(
      `WITH d AS (
         DELETE FROM school_rooms r
         WHERE r.zone_id IS NULL OR NOT ${linkedR}
         RETURNING r.id
       ) SELECT COUNT(*)::text AS count FROM d`,
    );
    const zoneDel = await query<{ count: string }>(
      `WITH d AS (
         DELETE FROM school_zones z
         WHERE z.floor_id IS NULL OR NOT ${linkedZ}
         RETURNING z.id
       ) SELECT COUNT(*)::text AS count FROM d`,
    );
    deleted = {
      orphanRooms: Number(roomDel?.rows[0]?.count ?? 0),
      orphanZones: Number(zoneDel?.rows[0]?.count ?? 0),
      total: 0,
    };
    deleted.total = deleted.orphanRooms + deleted.orphanZones;
  });

  purgeOrphanSpatialFromMem(zoneIds, roomIds);

  return { dryRun: false, counts, deleted };
}
