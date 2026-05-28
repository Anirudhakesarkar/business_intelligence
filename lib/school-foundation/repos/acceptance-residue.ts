import { orgIdFromPg, resolveOrgIdForPg } from '../../school-db/organization-id';
import { db as memDb } from '../store';
import { dbQuery, isDbEnabled, requirePool, withDbTransaction } from './shared';
import { deleteSite, listSites } from './sites';

/** Untagged rows left by `scripts/school-management-acceptance.mjs` (not in school_demo_entity_tags). */
export type AcceptanceResidueCounts = {
  cameras: number;
  inactiveTimetable: number;
  inactiveRosters: number;
  acceptanceCalendars: number;
  acceptanceSites: number;
  total: number;
};

export type AcceptanceResidueCleanupResult = {
  dryRun: boolean;
  counts: AcceptanceResidueCounts;
  deleted?: AcceptanceResidueCounts;
};

const CONFIRM_TOKEN = 'REMOVE_ACCEPTANCE_RESIDUE';

export { CONFIRM_TOKEN as ACCEPTANCE_RESIDUE_CONFIRM_TOKEN };

const cameraResidueSql = `(
  camera_code ILIKE '%accept%'
  OR name ILIKE '%acceptance%'
)`;

const calendarResidueSql = `(
  label ILIKE '%acceptance%'
  OR label ILIKE 'Patched accept-%'
)`;

const ACCEPT_SITE_PATTERN = /accept-\d+/i;

async function findAcceptanceSiteIds(organizationId: number | string): Promise<number[]> {
  const sites = await listSites(organizationId);
  return sites.filter((s) => ACCEPT_SITE_PATTERN.test(s.name)).map((s) => s.id);
}

export async function countAcceptanceResidueRows(
  organizationId: number | string = 1,
): Promise<AcceptanceResidueCounts> {
  const acceptanceSiteIds = await findAcceptanceSiteIds(organizationId);

  if (!isDbEnabled()) {
    const org = Number(organizationId);
    const cameras = memDb.cameras().filter(
      (c) =>
        c.organizationId === org &&
        (/accept/i.test(c.cameraCode) || /acceptance/i.test(c.name)),
    ).length;
    const inactiveTimetable = memDb
      .timetable()
      .filter((t) => t.organizationId === org && !t.isActive).length;
    const inactiveRosters = memDb
      .rosters()
      .filter((r) => r.organizationId === org && !r.isActive).length;
    const acceptanceCalendars = memDb
      .calendar()
      .filter(
        (c) =>
          c.organizationId === org &&
          (/acceptance/i.test(c.label ?? '') || /^Patched accept-/i.test(c.label ?? '')),
      ).length;
    const counts = {
      cameras, inactiveTimetable, inactiveRosters, acceptanceCalendars,
      acceptanceSites: acceptanceSiteIds.length, total: 0,
    };
    counts.total = cameras + inactiveTimetable + inactiveRosters + acceptanceCalendars + counts.acceptanceSites;
    return counts;
  }

  requirePool();
  const pgOrgId = resolveOrgIdForPg(organizationId);

  const [cam, tt, roster, cal] = await Promise.all([
    dbQuery<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM school_mgmt_cameras
       WHERE organization_id = $1 AND ${cameraResidueSql}`,
      [pgOrgId],
    ),
    dbQuery<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM school_timetable_entries
       WHERE organization_id = $1 AND is_active = FALSE`,
      [pgOrgId],
    ),
    dbQuery<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM school_staff_duty_rosters
       WHERE organization_id = $1 AND is_active = FALSE`,
      [pgOrgId],
    ),
    dbQuery<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM school_calendars
       WHERE organization_id = $1 AND ${calendarResidueSql}`,
      [pgOrgId],
    ),
  ]);

  const counts: AcceptanceResidueCounts = {
    cameras: Number(cam?.rows[0]?.count ?? 0),
    inactiveTimetable: Number(tt?.rows[0]?.count ?? 0),
    inactiveRosters: Number(roster?.rows[0]?.count ?? 0),
    acceptanceCalendars: Number(cal?.rows[0]?.count ?? 0),
    acceptanceSites: acceptanceSiteIds.length,
    total: 0,
  };
  counts.total =
    counts.cameras + counts.inactiveTimetable + counts.inactiveRosters +
    counts.acceptanceCalendars + counts.acceptanceSites;
  return counts;
}

function purgeAcceptanceResidueFromMem(counts: AcceptanceResidueCounts, organizationId: number) {
  if (counts.cameras) {
    const cameras = memDb.cameras();
    for (let i = cameras.length - 1; i >= 0; i--) {
      const c = cameras[i];
      if (
        c.organizationId === organizationId &&
        (/accept/i.test(c.cameraCode) || /acceptance/i.test(c.name))
      ) {
        cameras.splice(i, 1);
      }
    }
  }
  if (counts.inactiveTimetable) {
    const tt = memDb.timetable();
    for (let i = tt.length - 1; i >= 0; i--) {
      if (tt[i].organizationId === organizationId && !tt[i].isActive) tt.splice(i, 1);
    }
  }
  if (counts.inactiveRosters) {
    const rr = memDb.rosters();
    for (let i = rr.length - 1; i >= 0; i--) {
      if (rr[i].organizationId === organizationId && !rr[i].isActive) rr.splice(i, 1);
    }
  }
  if (counts.acceptanceCalendars) {
    const cal = memDb.calendar();
    for (let i = cal.length - 1; i >= 0; i--) {
      const row = cal[i];
      if (
        row.organizationId === organizationId &&
        (/acceptance/i.test(row.label ?? '') || /^Patched accept-/i.test(row.label ?? ''))
      ) {
        cal.splice(i, 1);
      }
    }
  }
}

export async function removeAcceptanceResidueRows(opts: {
  organizationId?: number | string;
  dryRun: boolean;
}): Promise<AcceptanceResidueCleanupResult> {
  const organizationId = opts.organizationId ?? 1;
  const counts = await countAcceptanceResidueRows(organizationId);
  if (opts.dryRun || counts.total === 0) {
    return { dryRun: true, counts };
  }

  // Delete acceptance sites first (cascades to buildings, floors, zones, rooms in PG)
  if (counts.acceptanceSites > 0) {
    const siteIds = await findAcceptanceSiteIds(organizationId);
    for (const id of siteIds) {
      try { await deleteSite(id); } catch { /* already gone */ }
    }
    // Also purge from in-memory store
    if (!isDbEnabled()) {
      const org = Number(organizationId);
      const siteIds2 = memDb.sites().filter((s) => s.organizationId === org && ACCEPT_SITE_PATTERN.test(s.name)).map((s) => s.id);
      const arr = memDb.sites();
      for (let i = arr.length - 1; i >= 0; i--) {
        if (siteIds2.includes(arr[i].id)) arr.splice(i, 1);
      }
    }
  }

  if (!isDbEnabled()) {
    purgeAcceptanceResidueFromMem(counts, Number(organizationId));
    return { dryRun: false, counts, deleted: counts };
  }

  requirePool();
  const pgOrgId = resolveOrgIdForPg(organizationId);

  await withDbTransaction(async (query) => {
    await query(
      `DELETE FROM school_mgmt_cameras WHERE organization_id = $1 AND ${cameraResidueSql}`,
      [pgOrgId],
    );
    await query(
      `DELETE FROM school_timetable_entries WHERE organization_id = $1 AND is_active = FALSE`,
      [pgOrgId],
    );
    await query(
      `DELETE FROM school_staff_duty_rosters WHERE organization_id = $1 AND is_active = FALSE`,
      [pgOrgId],
    );
    await query(
      `DELETE FROM school_calendars WHERE organization_id = $1 AND ${calendarResidueSql}`,
      [pgOrgId],
    );
  });

  purgeAcceptanceResidueFromMem(counts, orgIdFromPg(pgOrgId ?? organizationId));
  return { dryRun: false, counts, deleted: counts };
}
