import { isDbEnabled } from './pool';

/** True when Postgres is required and JSON snapshot fallback is disabled. */
export function isStrictDbMode(): boolean {
  return isDbEnabled() && process.env.SCHOOL_SNAPSHOT === '0';
}
