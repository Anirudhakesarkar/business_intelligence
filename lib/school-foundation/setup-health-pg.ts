import { resolveOrgIdForPg } from '../school-db/organization-id';
import { dbQuery, isDbEnabled } from '../school-db/pool';
import { columnExists, tableExists } from './repos/shared';
import type { SetupHealth } from './types';
import { applyPgMetricsToSetupHealth, type SetupHealthPgMetrics } from './setup-health-core';
import { getSetupHealth } from './store';

export type { SetupHealthPgMetrics } from './setup-health-core';

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

/** Active-row counts read directly from Postgres (strict-mode overview alignment). */
export async function countSetupHealthMetricsFromPg(
  organizationId: number,
): Promise<SetupHealthPgMetrics | null> {
  if (!isDbEnabled()) return null;
  const pgOrg = resolveOrgIdForPg(organizationId);
  const siteTable = await resolveSiteTable();
  const siteColumn = await resolveBuildingSiteColumn();

  const count = async (sql: string, params: unknown[] = []) => {
    const r = await dbQuery<{ count: string }>(sql, params);
    return Number(r?.rows[0]?.count ?? 0);
  };

  const activeCameras = await count(
    `SELECT COUNT(*)::text AS count FROM school_mgmt_cameras
     WHERE organization_id = $1 AND status = 'Active'`,
    [pgOrg],
  );
  const mappedActiveCameras = await count(
    `SELECT COUNT(*)::text AS count FROM school_mgmt_cameras
     WHERE organization_id = $1 AND status = 'Active' AND (zone_id IS NOT NULL OR room_id IS NOT NULL)`,
    [pgOrg],
  );
  const activeTimetable = await count(
    `SELECT COUNT(*)::text AS count FROM school_timetable_entries
     WHERE organization_id = $1 AND is_active = TRUE`,
    [pgOrg],
  );
  const activeRosters = await count(
    `SELECT COUNT(*)::text AS count FROM school_staff_duty_rosters
     WHERE organization_id = $1 AND is_active = TRUE`,
    [pgOrg],
  );
  const calendarDays = await count(
    `SELECT COUNT(*)::text AS count FROM school_calendars WHERE organization_id = $1`,
    [pgOrg],
  );

  let orgRooms = 0;
  let roomsWithCapacity = 0;
  if (siteTable && siteColumn) {
    orgRooms = await count(
      `SELECT COUNT(*)::text AS count FROM school_rooms r
       JOIN school_zones z ON z.id = r.zone_id
       JOIN school_floors f ON f.id = z.floor_id
       JOIN school_buildings b ON b.id = f.building_id
       JOIN ${siteTable} s ON s.id = b.${siteColumn}
       WHERE s.organization_id = $1`,
      [pgOrg],
    );
    roomsWithCapacity = await count(
      `SELECT COUNT(*)::text AS count FROM school_rooms r
       JOIN school_zones z ON z.id = r.zone_id
       JOIN school_floors f ON f.id = z.floor_id
       JOIN school_buildings b ON b.id = f.building_id
       JOIN ${siteTable} s ON s.id = b.${siteColumn}
       WHERE s.organization_id = $1 AND r.capacity > 0`,
      [pgOrg],
    );
  }

  return {
    activeCameras,
    mappedActiveCameras,
    orgRooms,
    roomsWithCapacity,
    activeTimetable,
    activeRosters,
    calendarDays,
  };
}

/** Merge PG active-row metrics into setup health (strict production mode). */
export async function getSetupHealthWithPgMetrics(organizationId: number): Promise<SetupHealth> {
  const health = getSetupHealth(organizationId);
  const pg = await countSetupHealthMetricsFromPg(organizationId);
  if (!pg) return health;
  return applyPgMetricsToSetupHealth(health, pg);
}
