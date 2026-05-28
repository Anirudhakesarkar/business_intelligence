import { getPool, dbQuery, isDbEnabled } from '../../school-db/pool';
import type { QueryResultRow } from 'pg';
const tableExistsCache = new Map<string, boolean>();
const columnExistsCache = new Map<string, boolean>();

export class DbDisabledError extends Error {
  constructor() {
    super('Postgres is not configured (DATABASE_URL missing or SCHOOL_INTELLIGENCE_DB=0).');
    this.name = 'DbDisabledError';
  }
}

export function requirePool() {
  if (!isDbEnabled()) throw new DbDisabledError();
}

export function num(v: string | number | null | undefined): number {
  return Number(v);
}

export async function tableExists(tableName: string): Promise<boolean> {
  if (tableExistsCache.has(tableName)) return tableExistsCache.get(tableName)!;
  const r = await dbQuery<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS "exists"`,
    [tableName],
  );
  const exists = Boolean(r?.rows?.[0]?.exists);
  tableExistsCache.set(tableName, exists);
  return exists;
}

export async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const key = `${tableName}.${columnName}`;
  if (columnExistsCache.has(key)) return columnExistsCache.get(key)!;
  const r = await dbQuery<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    ) AS "exists"`,
    [tableName, columnName],
  );
  const exists = Boolean(r?.rows?.[0]?.exists);
  columnExistsCache.set(key, exists);
  return exists;
}

export type DbQueryFn = <T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
) => Promise<{ rows: T[]; rowCount: number | null } | null>;

/** Run queries in a single Postgres transaction (rolls back on error). */
export async function withDbTransaction<T>(fn: (query: DbQueryFn) => Promise<T>): Promise<T> {
  const p = getPool();
  if (!p) throw new DbDisabledError();
  const client = await p.connect();
  const query: DbQueryFn = async (sql, params = []) => client.query(sql, params);
  try {
    await client.query('BEGIN');
    const result = await fn(query);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export { dbQuery, isDbEnabled };
