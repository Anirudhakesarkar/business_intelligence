import { dbQuery, isDbEnabled } from '../../school-db/pool';

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

export { dbQuery, isDbEnabled };
