import { readFileSync } from 'fs';
import { join } from 'path';
import { SCORE_DEFINITIONS } from '../school-score-engine/definitions';
import { getPool, isDbEnabled } from './pool';

const MIGRATION_DIR = join(process.cwd(), 'db/migrations');

/** School Intelligence migrations (067–072) plus organizations bootstrap. */
export const SCHOOL_MIGRATION_FILES = [
  'create_organizations_table.sql',
  '067_school_foundation.sql',
  '068_school_ai_signals.sql',
  '069_school_rule_engine.sql',
  '070_school_daily_summaries.sql',
  '071_school_score_engine.sql',
  '072_school_gpt_copilot.sql',
  '073_school_runtime_snapshot.sql',
] as const;

export type MigrateResult = {
  ok: boolean;
  applied: string[];
  skipped: string[];
  errors: { file: string; error: string }[];
};

export async function runSchoolMigrations(): Promise<MigrateResult> {
  if (!isDbEnabled()) {
    return { ok: false, applied: [], skipped: [], errors: [{ file: '-', error: 'DATABASE_URL not set or SCHOOL_INTELLIGENCE_DB=0' }] };
  }
  const pool = getPool();
  if (!pool) {
    return { ok: false, applied: [], skipped: [], errors: [{ file: '-', error: 'Postgres pool unavailable' }] };
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      file TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const applied: string[] = [];
  const skipped: string[] = [];
  const errors: { file: string; error: string }[] = [];

  for (const file of SCHOOL_MIGRATION_FILES) {
    if (file === 'create_organizations_table.sql') {
      const reg = await pool.query<{ exists: string | null }>(
        `SELECT to_regclass('public.organizations') AS exists`
      );
      if (reg.rows[0]?.exists) {
        const exists = await pool.query('SELECT 1 FROM schema_migrations WHERE file = $1', [file]);
        if ((exists.rowCount ?? 0) === 0) {
          await pool.query('INSERT INTO schema_migrations (file) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
        }
        skipped.push(file);
        continue;
      }
    }

    const exists = await pool.query('SELECT 1 FROM schema_migrations WHERE file = $1', [file]);
    if ((exists.rowCount ?? 0) > 0) {
      skipped.push(file);
      continue;
    }
    const sql = readFileSync(join(MIGRATION_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (file) VALUES ($1)', [file]);
      await client.query('COMMIT');
      applied.push(file);
    } catch (e) {
      await client.query('ROLLBACK');
      errors.push({ file, error: (e as Error).message });
    } finally {
      client.release();
    }
  }

  if (errors.length === 0) {
    await seedDemoOrganization(pool);
    await seedScoreDefinitions(pool);
  }

  return { ok: errors.length === 0, applied, skipped, errors };
}

async function seedDemoOrganization(pool: NonNullable<ReturnType<typeof getPool>>) {
  await pool.query(
    `INSERT INTO organizations (
      organization_name, organization_code, industry_type,
      registered_address, city, state, country, pincode,
      primary_contact_name, primary_contact_mobile, primary_contact_email,
      organization_status, is_active, is_deleted
    ) VALUES (
      'Demo School', 'DEMO-SCHOOL', 'Education',
      '12 Campus Road', 'Mumbai', 'Maharashtra', 'India', '400001',
      'Principal Demo', '9000000001', 'principal@demo.school',
      'Active', TRUE, FALSE
    ) ON CONFLICT (organization_code) DO NOTHING`,
  );
}
async function seedScoreDefinitions(pool: NonNullable<ReturnType<typeof getPool>>) {
  for (const def of SCORE_DEFINITIONS) {
    await pool.query(
      `INSERT INTO school_score_definitions (module_key, formula_version, parameters)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (module_key, formula_version) DO UPDATE SET parameters = EXCLUDED.parameters`,
      [def.moduleKey, def.formulaVersion, JSON.stringify({ description: def.description, inputs: def.inputs })]
    );
  }
}
