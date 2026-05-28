#!/usr/bin/env node
/**
 * Seed cloud_zone_activity_summary for local school acceptance (5-min windows).
 * Usage: node scripts/seed-cloud-zone-activity.mjs [--site site_local] [--hours 24]
 */
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: join(root, '.env') });
config({ path: join(root, '.env.local') });

const siteId = process.argv.includes('--site')
  ? process.argv[process.argv.indexOf('--site') + 1]
  : 'site_local';
const hours = Number(
  process.argv.includes('--hours') ? process.argv[process.argv.indexOf('--hours') + 1] : 24,
);

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const siteCheck = await pool.query(`SELECT id FROM sites WHERE id = $1`, [siteId]);
  if (!siteCheck.rows.length) {
    console.error(`Site "${siteId}" not found in sites table`);
    process.exit(1);
  }

  const camRes = await pool.query(
    `SELECT id::text AS camera_id, zone_id::text AS zone_id
     FROM school_mgmt_cameras
     WHERE organization_id = 1 AND status = 'Active'
     ORDER BY id
     LIMIT 20`,
  );
  if (!camRes.rows.length) {
    console.error('No active school_mgmt_cameras for org 1');
    process.exit(1);
  }

  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const windows = Math.ceil((hours * 60) / 5);
  let inserted = 0;

  for (let w = 0; w < windows; w++) {
    const windowEnd = new Date(now - w * windowMs);
    const windowStart = new Date(windowEnd.getTime() - windowMs);
    for (const cam of camRes.rows) {
      const personAvg = 2 + (w % 8);
      const r = await pool.query(
        `INSERT INTO cloud_zone_activity_summary (
          site_id, camera_id, zone_id, window_start, window_end, duration_seconds,
          person_count_avg, person_count_max, vehicle_count, equipment_count,
          motion_score, activity_score, low_activity_flag, detection_count, source_frame_count, meta
        ) VALUES ($1, $2, $3, $4, $5, 300, $6, $7, 0, 0, $8, $8, $9, $10, $11, $12::jsonb)
        ON CONFLICT (site_id, camera_id, COALESCE(zone_id, ''), window_start) DO NOTHING
        RETURNING id`,
        [
          siteId,
          cam.camera_id,
          cam.zone_id ?? '',
          windowStart,
          windowEnd,
          personAvg,
          personAvg + 2,
          Math.min(100, personAvg * 12),
          personAvg < 3,
          personAvg * 5,
          personAvg * 3,
          JSON.stringify({ source: 'acceptance-seed', class_breakdown: { person: personAvg } }),
        ],
      );
      if (r.rowCount) inserted += 1;
    }
  }

  const countRes = await pool.query(
    `SELECT COUNT(*)::text AS count FROM cloud_zone_activity_summary WHERE site_id = $1`,
    [siteId],
  );
  console.log(
    JSON.stringify(
      {
        ok: true,
        siteId,
        cameras: camRes.rows.length,
        windowsPerCamera: windows,
        inserted,
        totalForSite: Number(countRes.rows[0].count),
      },
      null,
      2,
    ),
  );
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
