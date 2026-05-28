const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Map API organizationId (often `1`) to Postgres organizations.org_id (UUID) or BIGINT id. */
export function resolveOrgIdForPg(raw: number | string | undefined): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const s = String(raw).trim();
  if (UUID_RE.test(s)) return s;
  const envUuid = process.env.SCHOOL_ORGANIZATION_UUID?.trim();
  if (envUuid && UUID_RE.test(envUuid) && (s === '1' || raw === 1)) return envUuid;
  if (/^\d+$/.test(s)) return s;
  throw new Error(`Invalid organizationId: ${s}`);
}

/** Expose a stable numeric id for in-memory store / Master Data UI (ORG_ID = 1). */
export function orgIdFromPg(pg: string | number): number {
  const s = String(pg);
  const envUuid = process.env.SCHOOL_ORGANIZATION_UUID?.trim();
  if (envUuid && s.toLowerCase() === envUuid.toLowerCase()) return 1;
  const n = Number(s);
  if (Number.isFinite(n) && /^\d+$/.test(s)) return n;
  return 1;
}
