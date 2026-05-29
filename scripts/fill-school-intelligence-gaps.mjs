#!/usr/bin/env node
/**
 * Fill production data gaps for School Intelligence (agent.md step 4):
 * - Remove orphan spatial rows
 * - Seed foundation when no campuses exist (Postgres, no demo tags)
 * - Run daily pipeline for target date (summaries + scores + persist)
 *
 * Usage:
 *   node scripts/fill-school-intelligence-gaps.mjs [YYYY-MM-DD]
 *   npm run fill:school-intelligence-gaps
 */
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: join(root, '.env') });
config({ path: join(root, '.env.local') });

const ORG = 1;
const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);

async function main() {
  const { removeOrphanSpatialRows } = await import('../lib/school-foundation/repos/orphan-spatial.ts');
  const { seedFoundationIfEmptyPg, countFoundationForOrg } = await import('../lib/school-foundation/seed-pg.ts');
  const { runDailySchoolIntelligenceJob } = await import('../lib/school-jobs/run-daily.ts');
  const { runSchoolMigrations } = await import('../lib/school-db/migrate.ts');
  const { getPool } = await import('../lib/school-db/pool.ts');

  console.log(`\n=== Fill School Intelligence gaps (org=${ORG}, date=${date}) ===\n`);

  const mig = await runSchoolMigrations();
  if (!mig.ok) console.warn('Migration warnings:', mig.errors);
  else console.log('Migrations OK; score definitions upserted');

  const before = await countFoundationForOrg(ORG);
  console.log('Foundation before:', before);

  const orphans = await removeOrphanSpatialRows({ dryRun: false });
  console.log('Orphan spatial cleanup:', orphans.deleted ?? orphans.counts);

  const seed = await seedFoundationIfEmptyPg(ORG);
  console.log('Foundation seed:', seed.skipped ? 'skipped (exists)' : 'created', seed.counts ?? seed);

  const pipeline = await runDailySchoolIntelligenceJob({
    organizationId: ORG,
    date,
    seedIfEmpty: false,
    includeGpt: true,
  });
  console.log('Pipeline scores overall:', pipeline.scores?.overallScore ?? pipeline.scores);
  console.log('Pipeline aggregation tables:', pipeline.aggregation?.tables ?? pipeline.aggregation);

  const pool = getPool();
  if (pool) {
    const checks = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS c FROM school_campuses WHERE organization_id = $1`, [ORG]),
      pool.query(
        `SELECT COUNT(*)::int AS c FROM school_teacher_daily_intelligence WHERE organization_id = $1 AND summary_date = $2::date`,
        [ORG, date],
      ),
      pool.query(
        `SELECT overall_score FROM school_daily_scores WHERE organization_id = $1 AND score_date = $2::date LIMIT 1`,
        [ORG, date],
      ),
      pool.query(`SELECT COUNT(*)::int AS c FROM school_intelligence_events WHERE organization_id = $1`, [ORG]),
    ]);
    console.log('\nPostgres verification:');
    console.log('  campuses:', checks[0].rows[0]?.c);
    console.log('  teacher daily rows:', checks[1].rows[0]?.c);
    console.log('  overall score:', checks[2].rows[0]?.overall_score ?? 'null');
    console.log('  intelligence events:', checks[3].rows[0]?.c);
    await pool.end();
  }

  console.log('\nDone.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
