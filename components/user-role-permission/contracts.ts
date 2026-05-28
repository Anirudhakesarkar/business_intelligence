import type { PermissionRecord, RoleRecord, UserRecord } from './types';

function asObj(v: unknown): Record<string, unknown> { return (v && typeof v === 'object' ? v : {}) as Record<string, unknown>; }
function asStr(v: unknown, fb=''): string { return typeof v === 'string' ? v : fb; }
/** API may return bigint/numeric ids; keep stable string keys for lists and permission matrix. */
function asId(v: unknown, fb = ''): string {
  if (typeof v === 'string' && v.trim()) return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return fb;
}

export function parseRole(v: unknown): RoleRecord {
  const o = asObj(v);
  return { id: asId(o.id), role_name: asStr(o.role_name), role_code: asStr(o.role_code), role_level: asStr(o.role_level), role_status: asStr(o.role_status,'Active'), is_system_role: Boolean(o.is_system_role) };
}
export function parsePermission(v: unknown): PermissionRecord {
  const o = asObj(v);
  return { id: asStr(o.id), permission_name: asStr(o.permission_name), permission_key: asStr(o.permission_key), permission_group: asStr(o.permission_group), permission_status: asStr(o.permission_status,'Active') };
}
export function parseUser(v: unknown): UserRecord {
  const o = asObj(v);
  return {
    id: asStr(o.id),
    organization_id: asStr(o.organization_id),
    organization_name: asStr(o.organization_name,''),
    full_name: asStr(o.full_name),
    email: asStr(o.email),
    mobile: asStr(o.mobile),
    department: typeof o.department === 'string' ? o.department : null,
    user_status: asStr(o.user_status,'Invited') as UserRecord['user_status'],
    login_allowed: Boolean(o.login_allowed),
    role_id: typeof o.role_id === 'string' ? o.role_id : null,
    role_name: typeof o.role_name === 'string' ? o.role_name : null,
    assigned_sites: Array.isArray(o.assigned_sites) ? o.assigned_sites as Array<{site_id:string;site_name:string}> : [],
  };
}
