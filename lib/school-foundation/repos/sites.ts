/**
 * sites repo — Postgres-backed CRUD for school_sites.
 *
 * PG is the system of record. Writes are mirrored to the in-memory `sites` array
 * in lib/school-foundation/store.ts so legacy synchronous callers (seed.ts,
 * bulk-import, getSetupHealth's listRooms cascade) keep working until they get
 * migrated to PG too.
 *
 * This file is the PATTERN for the other 16 entities in store.ts. To migrate
 * buildings/floors/zones/rooms/cameras/classes/sections/etc, copy this file,
 * change the table name, columns, and types — then update the matching API
 * routes to await the new functions.
 *
 * Once every entity has a repo, the in-memory arrays in store.ts and the
 * mirroring blocks below can be deleted, and `db.sites()` and friends removed.
 */
import type { Site } from '../types';
import { orgIdFromPg, resolveOrgIdForPg } from '../../school-db/organization-id';
import { dbQuery, isDbEnabled } from '../../school-db/pool';
import { db as memDb, logAudit, _ensureNextIdAbove } from '../store';
import { DbDisabledError, columnExists, requirePool, tableExists } from './shared';

export { DbDisabledError };

type SiteRow = {
  id: string | number;
  organization_id: string | number;
  name: string;
  address: string | null;
  is_active: boolean;
};

type SiteSchema = { table: 'school_sites' | 'school_campuses'; nameColumn: 'name' | 'campus_name' };

let siteSchemaCache: SiteSchema | null = null;
async function resolveSiteSchema(): Promise<SiteSchema> {
  if (siteSchemaCache) return siteSchemaCache;
  if (await tableExists('school_sites')) {
    siteSchemaCache = { table: 'school_sites', nameColumn: 'name' };
    return siteSchemaCache;
  }
  if (await tableExists('school_campuses')) {
    const hasName = await columnExists('school_campuses', 'name');
    siteSchemaCache = { table: 'school_campuses', nameColumn: hasName ? 'name' : 'campus_name' };
    return siteSchemaCache;
  }
  siteSchemaCache = { table: 'school_sites', nameColumn: 'name' };
  return siteSchemaCache;
}

function fromRow(r: SiteRow): Site {
  return {
    id: Number(r.id),
    organizationId: orgIdFromPg(r.organization_id),
    name: r.name,
    address: r.address ?? undefined,
    isActive: r.is_active,
  };
}

function mirrorInsert(row: Site) {
  const arr = memDb.sites();
  if (!arr.some((s) => s.id === row.id)) arr.push(row);
  _ensureNextIdAbove(row.id);
}

function mirrorUpdate(row: Site) {
  const arr = memDb.sites();
  const i = arr.findIndex((s) => s.id === row.id);
  if (i >= 0) arr[i] = row;
  else arr.push(row);
}

function mirrorDelete(id: number) {
  const arr = memDb.sites();
  const i = arr.findIndex((s) => s.id === id);
  if (i >= 0) arr.splice(i, 1);
}

export async function listSites(organizationId?: number | string): Promise<Site[]> {
  if (!isDbEnabled()) {
    if (organizationId === undefined) return [...memDb.sites()];
    const org = Number(organizationId);
    return memDb.sites().filter((s) => s.organizationId === org);
  }
  requirePool();
  const schema = await resolveSiteSchema();
  const pgOrgId = organizationId !== undefined ? resolveOrgIdForPg(organizationId) : undefined;
  const sql = pgOrgId
    ? `SELECT id, organization_id, ${schema.nameColumn} AS name, address, is_active
       FROM ${schema.table} WHERE organization_id = $1 ORDER BY id`
    : `SELECT id, organization_id, ${schema.nameColumn} AS name, address, is_active FROM ${schema.table} ORDER BY id`;
  const params = pgOrgId ? [pgOrgId] : [];
  const r = await dbQuery<SiteRow>(sql, params);
  const rows = (r?.rows ?? []).map(fromRow);
  // Keep in-memory cache consistent with PG so getSetupHealth / listRooms see the same data.
  for (const row of rows) mirrorInsert(row);
  return rows;
}

export async function getSiteById(id: number): Promise<Site | null> {
  requirePool();
  const schema = await resolveSiteSchema();
  const r = await dbQuery<SiteRow>(
    `SELECT id, organization_id, ${schema.nameColumn} AS name, address, is_active FROM ${schema.table} WHERE id = $1`,
    [id],
  );
  const row = r?.rows[0];
  if (!row) return null;
  const site = fromRow(row);
  mirrorUpdate(site);
  return site;
}

export type CreateSiteInput = {
  organizationId: number | string;
  name: string;
  address?: string;
  isActive?: boolean;
};

export async function createSite(input: CreateSiteInput): Promise<Site> {
  requirePool();
  const schema = await resolveSiteSchema();
  if (!input.name?.trim()) throw new Error('Name required');
  const r = await dbQuery<SiteRow>(
    `INSERT INTO ${schema.table} (organization_id, ${schema.nameColumn}, address, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING id, organization_id, ${schema.nameColumn} AS name, address, is_active`,
    [
      resolveOrgIdForPg(input.organizationId),
      input.name.trim(),
      input.address ?? null,
      input.isActive ?? true,
    ],
  );
  if (!r?.rows[0]) throw new Error('Failed to create site');
  const row = fromRow(r.rows[0]);
  mirrorInsert(row);
  logAudit('create', 'site', row.id, row);
  return row;
}

export type PatchSiteInput = Partial<Pick<Site, 'name' | 'address' | 'isActive'>>;

export async function patchSite(id: number, patch: PatchSiteInput): Promise<Site> {
  requirePool();
  const schema = await resolveSiteSchema();
  if (patch.name !== undefined && !String(patch.name).trim()) {
    throw new Error('Name required');
  }
  const before = await getSiteById(id);
  if (!before) throw new Error('Site not found');

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (patch.name !== undefined) {
    sets.push(`${schema.nameColumn} = $${idx++}`);
    params.push(patch.name.trim());
  }
  if (patch.address !== undefined) {
    sets.push(`address = $${idx++}`);
    params.push(patch.address ?? null);
  }
  if (patch.isActive !== undefined) {
    sets.push(`is_active = $${idx++}`);
    params.push(patch.isActive);
  }
  if (!sets.length) return before;
  params.push(id);

  const r = await dbQuery<SiteRow>(
    `UPDATE ${schema.table} SET ${sets.join(', ')} WHERE id = $${idx}
     RETURNING id, organization_id, ${schema.nameColumn} AS name, address, is_active`,
    params,
  );
  if (!r?.rows[0]) throw new Error('Site not found');
  const row = fromRow(r.rows[0]);
  mirrorUpdate(row);
  logAudit('update', 'site', id, row, before);
  return row;
}

export async function deleteSite(id: number): Promise<{ ok: true }> {
  requirePool();
  const schema = await resolveSiteSchema();
  const before = await getSiteById(id);
  if (!before) throw new Error('Site not found');
  // school_buildings (and downstream tables) have ON DELETE CASCADE in migration 067,
  // so a single DELETE removes the entire site → building → floor → zone → room tree
  // in Postgres. The in-memory cascade in store.ts only matters for the in-memory
  // copies of those rows, which are still present until those entities are also
  // migrated to PG-backed repos.
  await dbQuery(`DELETE FROM ${schema.table} WHERE id = $1`, [id]);
  mirrorDelete(id);
  logAudit('delete', 'site', id, undefined, before);
  return { ok: true };
}

/**
 * Cold-start hydration: pull all sites from PG into the in-memory cache so
 * synchronous aggregations (getSetupHealth, listRooms, etc.) that still read
 * `db.sites()` see consistent data. Safe to call multiple times — only inserts
 * rows that aren't already cached.
 */
export async function hydrateSitesFromPg(): Promise<{ hydrated: number }> {
  if (!isDbEnabled()) return { hydrated: 0 };
  const schema = await resolveSiteSchema();
  const r = await dbQuery<SiteRow>(
    `SELECT id, organization_id, ${schema.nameColumn} AS name, address, is_active FROM ${schema.table}`,
  );
  const rows = (r?.rows ?? []).map(fromRow);
  for (const row of rows) mirrorInsert(row);
  return { hydrated: rows.length };
}
