import { Pool, type QueryResultRow } from 'pg';
import { SCHOOL_MIGRATION_FILES } from './migrate';

let pool: Pool | null = null;

export function isDbEnabled() {
  return Boolean(process.env.DATABASE_URL && process.env.SCHOOL_INTELLIGENCE_DB !== '0');
}

export function getPool(): Pool | null {
  if (!isDbEnabled()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
  const p = getPool();
  if (!p) return null;
  return p.query<T>(sql, params);
}

export async function checkSchoolMigrations() {
  const p = getPool();
  if (!p) return { enabled: false, applied: [] as string[] };
  try {
    const r = await p.query<{ file: string }>(
      `SELECT file FROM schema_migrations WHERE file = ANY($1::text[]) ORDER BY file`,
      [SCHOOL_MIGRATION_FILES as unknown as string[]]
    );
    const applied = r.rows.map((x) => x.file);
    const pending = SCHOOL_MIGRATION_FILES.filter((f) => !applied.includes(f));
    return { enabled: true, ok: pending.length === 0, applied, pending };
  } catch (e) {
    return { enabled: true, ok: false, error: (e as Error).message, applied: [] };
  }
}
