import { resolveOrgIdForPg } from '../school-db/organization-id';
import { dbQuery, isDbEnabled } from '../school-db/pool';
import { tableExists, withDbTransaction, type DbQueryFn } from './repos/shared';
import { db, _ensureNextIdAbove } from './store';

export const DEMO_SOURCE = 'demo' as const;

export type DemoEntityType =
  | 'site'
  | 'building'
  | 'floor'
  | 'zone'
  | 'room'
  | 'class'
  | 'section'
  | 'subject'
  | 'teacher'
  | 'staff'
  | 'camera'
  | 'timetable'
  | 'roster'
  | 'calendar'
  | 'time_window';

export type DemoTag = { entityType: DemoEntityType; entityId: number };

/** In-memory demo tags when Postgres is disabled (snapshot mode). */
const memTags = new Map<number, DemoTag[]>();

export function demoMetadata(extra?: Record<string, unknown>) {
  return { source: DEMO_SOURCE, ...extra };
}

export class DemoTagCollector {
  private readonly pending: DemoTag[] = [];

  constructor(private readonly organizationId: number) {}

  tag(entityType: DemoEntityType, entityId: number) {
    this.pending.push({ entityType, entityId });
    _ensureNextIdAbove(entityId);
  }

  async flush() {
    if (!this.pending.length) return;
    await persistDemoTags(this.organizationId, this.pending);
    this.pending.length = 0;
  }
}

export async function persistDemoTags(organizationId: number, tags: DemoTag[]) {
  if (!tags.length) return;
  const existing = memTags.get(organizationId) ?? [];
  const seen = new Set(existing.map((t) => `${t.entityType}:${t.entityId}`));
  for (const t of tags) {
    const key = `${t.entityType}:${t.entityId}`;
    if (!seen.has(key)) {
      existing.push(t);
      seen.add(key);
    }
  }
  memTags.set(organizationId, existing);

  if (!isDbEnabled()) return;
  const pgOrg = resolveOrgIdForPg(organizationId);
  for (const t of tags) {
    await dbQuery(
      `INSERT INTO school_demo_entity_tags (organization_id, entity_type, entity_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (organization_id, entity_type, entity_id) DO NOTHING`,
      [pgOrg, t.entityType, t.entityId],
    );
  }
}

export async function clearDemoTagsForOrg(organizationId: number) {
  memTags.delete(organizationId);
  if (!isDbEnabled()) return;
  const pgOrg = resolveOrgIdForPg(organizationId);
  await dbQuery(`DELETE FROM school_demo_entity_tags WHERE organization_id = $1`, [pgOrg]);
}

async function loadDemoTags(organizationId: number): Promise<DemoTag[]> {
  if (isDbEnabled()) {
    const pgOrg = resolveOrgIdForPg(organizationId);
    const r = await dbQuery<{ entity_type: string; entity_id: string }>(
      `SELECT entity_type, entity_id FROM school_demo_entity_tags WHERE organization_id = $1`,
      [pgOrg],
    );
    const fromPg = (r?.rows ?? []).map((row) => ({
      entityType: row.entity_type as DemoEntityType,
      entityId: Number(row.entity_id),
    }));
    if (fromPg.length) memTags.set(organizationId, fromPg);
    return fromPg;
  }
  return memTags.get(organizationId) ?? [];
}

export type DemoTagCounts = Record<string, number> & { total: number };

export async function countDemoTaggedForOrg(organizationId: number): Promise<DemoTagCounts> {
  const tags = await loadDemoTags(organizationId);
  const counts: DemoTagCounts = { total: 0 };
  for (const t of tags) {
    counts[t.entityType] = (counts[t.entityType] ?? 0) + 1;
    counts.total += 1;
  }
  return counts;
}

function idsByType(tags: DemoTag[]): Map<DemoEntityType, number[]> {
  const map = new Map<DemoEntityType, number[]>();
  for (const t of tags) {
    const list = map.get(t.entityType) ?? [];
    list.push(t.entityId);
    map.set(t.entityType, list);
  }
  return map;
}

function removeIdsFromMem<T extends { id: number }>(arr: T[], ids: number[]) {
  if (!ids.length) return;
  const set = new Set(ids);
  for (let i = arr.length - 1; i >= 0; i--) {
    if (set.has(arr[i].id)) arr.splice(i, 1);
  }
}

function purgeDemoTaggedFromMem(byType: Map<DemoEntityType, number[]>) {
  removeIdsFromMem(db.timetable(), byType.get('timetable') ?? []);
  removeIdsFromMem(db.rosters(), byType.get('roster') ?? []);
  removeIdsFromMem(db.cameras(), byType.get('camera') ?? []);
  removeIdsFromMem(db.calendar(), byType.get('calendar') ?? []);
  removeIdsFromMem(db.timeWindows(), byType.get('time_window') ?? []);
  removeIdsFromMem(db.sections(), byType.get('section') ?? []);
  removeIdsFromMem(db.classes(), byType.get('class') ?? []);
  removeIdsFromMem(db.subjects(), byType.get('subject') ?? []);
  removeIdsFromMem(db.teachers(), byType.get('teacher') ?? []);
  removeIdsFromMem(db.staff(), byType.get('staff') ?? []);
  removeIdsFromMem(db.rooms(), byType.get('room') ?? []);
  removeIdsFromMem(db.zones(), byType.get('zone') ?? []);
  removeIdsFromMem(db.floors(), byType.get('floor') ?? []);
  removeIdsFromMem(db.buildings(), byType.get('building') ?? []);
  removeIdsFromMem(db.sites(), byType.get('site') ?? []);
}

async function deleteTaggedPg(query: DbQueryFn, table: string, ids: number[]) {
  if (!ids.length) return 0;
  const r = await query<{ count: string }>(
    `WITH d AS (DELETE FROM ${table} WHERE id = ANY($1::bigint[]) RETURNING id)
     SELECT COUNT(*)::text AS count FROM d`,
    [ids],
  );
  return Number(r?.rows[0]?.count ?? 0);
}

export type DemoCleanupResult = {
  dryRun: boolean;
  counts: DemoTagCounts;
  deleted?: DemoTagCounts;
};

const PG_DELETE_ORDER: [DemoEntityType, string][] = [
  ['timetable', 'school_timetable_entries'],
  ['roster', 'school_staff_duty_rosters'],
  ['camera', 'school_mgmt_cameras'],
  ['calendar', 'school_calendars'],
  ['time_window', 'school_time_windows'],
  ['section', 'school_sections'],
  ['class', 'school_classes'],
  ['subject', 'school_subjects'],
  ['teacher', 'school_teachers'],
  ['staff', 'school_staff_members'],
  ['room', 'school_rooms'],
  ['zone', 'school_zones'],
  ['floor', 'school_floors'],
  ['building', 'school_buildings'],
];

async function resolveSiteTableName(): Promise<string> {
  if (await tableExists('school_sites')) return 'school_sites';
  if (await tableExists('school_campuses')) return 'school_campuses';
  return 'school_campuses';
}

/** Tag every foundation row currently linked to an organization (call after demo seed). */
export async function tagCurrentFoundationAsDemo(organizationId: number) {
  const tags: DemoTag[] = [];
  const siteIds = new Set(
    db.sites().filter((s) => s.organizationId === organizationId).map((s) => s.id),
  );
  for (const s of db.sites()) {
    if (s.organizationId === organizationId) tags.push({ entityType: 'site', entityId: s.id });
  }
  const buildingIds = new Set(
    db.buildings().filter((b) => siteIds.has(b.siteId)).map((b) => b.id),
  );
  for (const id of buildingIds) tags.push({ entityType: 'building', entityId: id });
  const floorIds = new Set(
    db.floors().filter((f) => buildingIds.has(f.buildingId)).map((f) => f.id),
  );
  for (const id of floorIds) tags.push({ entityType: 'floor', entityId: id });
  const zoneIds = new Set(
    db.zones().filter((z) => z.floorId && floorIds.has(z.floorId)).map((z) => z.id),
  );
  for (const id of zoneIds) tags.push({ entityType: 'zone', entityId: id });
  for (const r of db.rooms()) {
    if (r.zoneId && zoneIds.has(r.zoneId)) tags.push({ entityType: 'room', entityId: r.id });
  }
  const classIds = new Set(
    db.classes().filter((c) => c.organizationId === organizationId).map((c) => c.id),
  );
  for (const id of classIds) tags.push({ entityType: 'class', entityId: id });
  for (const sec of db.sections()) {
    if (classIds.has(sec.classId)) tags.push({ entityType: 'section', entityId: sec.id });
  }
  for (const sub of db.subjects()) {
    if (sub.organizationId === organizationId) tags.push({ entityType: 'subject', entityId: sub.id });
  }
  for (const t of db.teachers()) {
    if (t.organizationId === organizationId) tags.push({ entityType: 'teacher', entityId: t.id });
  }
  for (const st of db.staff()) {
    if (st.organizationId === organizationId) tags.push({ entityType: 'staff', entityId: st.id });
  }
  for (const c of db.cameras()) {
    if (c.organizationId === organizationId) tags.push({ entityType: 'camera', entityId: c.id });
  }
  for (const t of db.timetable()) {
    if (t.organizationId === organizationId) tags.push({ entityType: 'timetable', entityId: t.id });
  }
  for (const r of db.rosters()) {
    if (r.organizationId === organizationId) tags.push({ entityType: 'roster', entityId: r.id });
  }
  for (const c of db.calendar()) {
    if (c.organizationId === organizationId) tags.push({ entityType: 'calendar', entityId: c.id });
  }
  for (const w of db.timeWindows()) {
    if (w.organizationId === organizationId) tags.push({ entityType: 'time_window', entityId: w.id });
  }
  await persistDemoTags(organizationId, tags);
}

export async function removeDemoTaggedForOrg(
  organizationId: number,
  opts: { dryRun: boolean },
): Promise<DemoCleanupResult> {
  const tags = await loadDemoTags(organizationId);
  const counts = await countDemoTaggedForOrg(organizationId);
  if (opts.dryRun || counts.total === 0) {
    return { dryRun: true, counts };
  }

  const byType = idsByType(tags);
  const deleted: DemoTagCounts = { total: 0 };

  if (isDbEnabled()) {
    const siteTable = await resolveSiteTableName();
    await withDbTransaction(async (query) => {
      for (const [entityType, tableName] of PG_DELETE_ORDER) {
        const table = entityType === 'site' ? siteTable : tableName;
        const ids = byType.get(entityType) ?? [];
        const n = await deleteTaggedPg(query, table, ids);
        if (n > 0) {
          deleted[entityType] = n;
          deleted.total += n;
        }
      }
      const pgOrg = resolveOrgIdForPg(organizationId);
      await query(`DELETE FROM school_demo_entity_tags WHERE organization_id = $1`, [pgOrg]);
    });
    memTags.delete(organizationId);
  }

  purgeDemoTaggedFromMem(byType);
  if (!isDbEnabled()) {
    deleted.total = counts.total;
    for (const [k, v] of Object.entries(counts)) {
      if (k !== 'total' && typeof v === 'number') deleted[k] = v;
    }
    await clearDemoTagsForOrg(organizationId);
  }

  return { dryRun: false, counts, deleted };
}
