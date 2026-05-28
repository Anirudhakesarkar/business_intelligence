import '@/lib/school-persistence/init';
import { json } from '@/lib/school-gpt-copilot/json';
import { checkSchoolMigrations, getPool, isDbEnabled } from '@/lib/school-db/pool';
import { isSchoolDemoUiEnabled } from '@/lib/school-foundation/runtime-mode';
import { countOrphanSpatialRows } from '@/lib/school-foundation/repos';
import { existsSync } from 'fs';
import { join } from 'path';

export async function GET() {
  const migrations = await checkSchoolMigrations();
  const pool = getPool();
  let cloudZoneActivity: { available: boolean; rowCount: number | null } = { available: false, rowCount: null };
  if (pool) {
    try {
      const tableRes = await pool.query<{ exists: string | null }>(
        `SELECT to_regclass('public.cloud_zone_activity_summary') AS exists`
      );
      const available = Boolean(tableRes.rows[0]?.exists);
      if (available) {
        const countRes = await pool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM cloud_zone_activity_summary`
        );
        cloudZoneActivity = {
          available,
          rowCount: Number(countRes.rows[0]?.count ?? 0),
        };
      } else {
        cloudZoneActivity = { available: false, rowCount: null };
      }
    } catch {
      cloudZoneActivity = { available: false, rowCount: null };
    }
  }
  const snapshotPath = join(process.cwd(), '.data/school-intelligence.json');
  const strictDbMode = isDbEnabled() && process.env.SCHOOL_SNAPSHOT === '0';
  let orphanSpatial = { orphanZones: 0, orphanRooms: 0, total: 0 };
  if (pool) {
    try {
      orphanSpatial = await countOrphanSpatialRows();
    } catch {
      /* ignore */
    }
  }
  return json({
    postgres: { ...migrations, configured: isDbEnabled() },
    snapshot: {
      enabled: process.env.SCHOOL_SNAPSHOT !== '0',
      exists: existsSync(snapshotPath),
      path: snapshotPath,
      dbPreferred: isDbEnabled() && process.env.SCHOOL_SNAPSHOT === '0',
    },
    openai: {
      configured: Boolean(process.env.OPENAI_API_KEY),
      mode: process.env.OPENAI_API_KEY ? ('live' as const) : ('demo' as const),
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    },
    aggregator: { cloudZoneActivity },
    demoUi: {
      enabled: isSchoolDemoUiEnabled(),
      productionMode: process.env.SCHOOL_PRODUCTION_MODE === '1',
    },
    strictDbMode,
    orphanSpatial,
    schoolManagementDeleteSemantics: {
      camera: 'DELETE sets status=Inactive in Postgres (row retained)',
      timetable: 'DELETE sets is_active=false (row retained)',
      staffDutyRoster: 'DELETE sets is_active=false (row retained)',
      setupHealthCounts: 'Active cameras, is_active timetable/roster, and calendar days only',
    },
  });
}
