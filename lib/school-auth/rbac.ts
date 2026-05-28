import type { NextRequest } from 'next/server';
import type { AuthUserRole } from '@/lib/types';
import { COOKIE_API_BASE } from '@/lib/auth-cookies';
import { isAllowedApiOrigin, normalizeApiOrigin } from '@/lib/allowed-api-origins';

export type SchoolPermission = 'read' | 'write' | 'admin';

export type SchoolPrincipal = {
  userId: string;
  role: AuthUserRole;
  organizationId?: number;
  email?: string;
};

export type SchoolAuthResult =
  | { ok: true; principal: SchoolPrincipal; permission: SchoolPermission }
  | { ok: false; status: number; error: string };

const READ_ROLES: AuthUserRole[] = ['superadmin', 'org_admin', 'site_admin', 'operator'];
const WRITE_ROLES: AuthUserRole[] = ['superadmin', 'org_admin', 'site_admin'];
const ADMIN_ROLES: AuthUserRole[] = ['superadmin', 'org_admin'];

export function schoolRbacEnabled() {
  return process.env.SCHOOL_RBAC === '1' || process.env.SCHOOL_RBAC === 'true';
}

export function isSchoolApiPath(pathname: string) {
  const prefixes = [
    '/api/school-',
    '/api/gpt/',
    '/api/daily-summaries',
    '/api/intelligence-rules',
    '/api/intelligence-events',
    '/api/school-management',
    '/api/camera-health/daily-score',
    '/api/camera-processing-configs',
    '/api/ai-signal',
    '/api/diagnostic-media',
    '/api/score-weight-profiles',
    '/api/school-scores',
    '/api/sites',
    '/api/buildings',
    '/api/zones',
    '/api/rooms',
    '/api/cameras',
    '/api/classes',
    '/api/sections',
    '/api/teachers',
    '/api/staff-members',
    '/api/subjects',
    '/api/timetable',
    '/api/school-calendar',
    '/api/staff-duty-rosters',
    '/api/school-time-windows',
    '/api/organizations/',
  ];
  if (pathname === '/api/school-db/status') return false;
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p));
}

export function requiredPermission(method: string, pathname: string): SchoolPermission {
  if (method === 'GET' || method === 'HEAD') return 'read';
  const adminPaths = [
    '/api/school-db/migrate',
    '/api/school-management/seed',
    '/api/school-intelligence/bootstrap',
    '/api/school-rule-engine/seed',
    '/api/school-daily-summaries/seed',
    '/api/school-gpt/seed',
  ];
  if (adminPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))) return 'admin';
  return 'write';
}

function roleAllowed(role: AuthUserRole, permission: SchoolPermission) {
  if (permission === 'read') return READ_ROLES.includes(role);
  if (permission === 'write') return WRITE_ROLES.includes(role);
  return ADMIN_ROLES.includes(role);
}

function parsePrincipalHeader(raw: string | null): SchoolPrincipal | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as SchoolPrincipal;
    if (p?.userId && p?.role) return p;
  } catch {
    /* ignore */
  }
  return null;
}

async function verifyViaBackend(token: string, apiBaseRaw: string): Promise<SchoolPrincipal | null> {
  if (!isAllowedApiOrigin(apiBaseRaw)) return null;
  const base = normalizeApiOrigin(apiBaseRaw);
  if (!base) return null;
  try {
    const res = await fetch(`${base}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      ok?: boolean;
      user?: { id?: string; email?: string; role?: AuthUserRole; org_id?: string };
    };
    const u = json.user;
    if (!u?.id || !u.role) return null;
    return {
      userId: String(u.id),
      role: u.role,
      email: u.email,
      organizationId: u.org_id ? Number(u.org_id) : undefined,
    };
  } catch {
    return null;
  }
}

export async function authorizeSchoolRequest(req: NextRequest): Promise<SchoolAuthResult> {
  const pathname = req.nextUrl.pathname;
  const permission = requiredPermission(req.method, pathname);

  if (!schoolRbacEnabled()) {
    return { ok: true, principal: { userId: 'system', role: 'org_admin', organizationId: 1 }, permission };
  }

  // Cron / worker bypass
  const cronSecret = process.env.SCHOOL_CRON_SECRET;
  if (cronSecret && req.headers.get('x-school-cron-secret') === cronSecret) {
    return { ok: true, principal: { userId: 'cron', role: 'superadmin' }, permission };
  }
  if (pathname.includes('/evaluate-scheduled') || pathname.includes('/aggregate-scheduled')) {
    if (cronSecret && req.headers.get('x-school-cron-secret') === cronSecret) {
      return { ok: true, principal: { userId: 'cron', role: 'superadmin' }, permission };
    }
  }
  const workerKey = process.env.WORKER_API_KEY;
  if (workerKey && pathname.startsWith('/api/ai-workers') && req.headers.get('x-worker-api-key') === workerKey) {
    return { ok: true, principal: { userId: 'worker', role: 'operator' }, permission };
  }

  const fromHeader = parsePrincipalHeader(req.headers.get('x-school-principal'));
  if (fromHeader && roleAllowed(fromHeader.role, permission)) {
    return { ok: true, principal: fromHeader, permission };
  }

  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!bearer) {
    return { ok: false, status: 401, error: 'Authorization required (Bearer token or school session).' };
  }

  if (process.env.SCHOOL_API_KEY && bearer === process.env.SCHOOL_API_KEY) {
    return { ok: true, principal: { userId: 'service', role: 'superadmin' }, permission };
  }

  if (process.env.NODE_ENV !== 'production' && bearer === 'demo-e2e-token') {
    const role = (req.headers.get('x-school-role') as AuthUserRole) || 'org_admin';
    const org = Number(req.nextUrl.searchParams.get('organizationId') || req.headers.get('x-school-org-id') || 1);
    if (!roleAllowed(role, permission)) {
      return { ok: false, status: 403, error: `Role ${role} cannot ${permission}.` };
    }
    return { ok: true, principal: { userId: 'demo', role, organizationId: org }, permission };
  }

  const apiBase = req.cookies.get(COOKIE_API_BASE)?.value;
  if (apiBase && process.env.SCHOOL_AUTH_VERIFY !== 'off') {
    const principal = await verifyViaBackend(bearer, apiBase);
    if (principal && roleAllowed(principal.role, permission)) {
      return { ok: true, principal, permission };
    }
  }

  return { ok: false, status: 403, error: 'Forbidden for school intelligence API.' };
}

export function parseActorId(principal: SchoolPrincipal): number | undefined {
  const n = Number(principal.userId);
  return Number.isFinite(n) ? n : undefined;
}
