import '@/lib/school-persistence/init';
import { json } from '@/lib/school-gpt-copilot/json';
import { checkSchoolMigrations, getPool, isDbEnabled } from '@/lib/school-db/pool';
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
  return json({
    postgres: { ...migrations, configured: isDbEnabled() },
    snapshot: { enabled: process.env.SCHOOL_SNAPSHOT !== '0', exists: existsSync(snapshotPath), path: snapshotPath },
    openai: { configured: Boolean(process.env.OPENAI_API_KEY) },
    aggregator: { cloudZoneActivity },
  });
}
