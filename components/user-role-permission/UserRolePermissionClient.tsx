'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/app/providers/auth-provider';
import { AccessDenied } from '@/components/auth/role-gate';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api-client';
import { DEPARTMENTS, LOGIN_PLATFORMS, USER_STATUSES } from './types';
import { parsePermission, parseRole, parseUser } from './contracts';
import { UserStatusBadge } from './UserStatusBadge';
import { useAdminBasePath } from '@/components/admin-navigation-context';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[6-9][0-9]{9}$/;

function splitCsv(v: string) {
  return v.split(',').map((x) => x.trim()).filter(Boolean);
}

function normalizeListPayload<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: T[] }).data;
  }
  return [];
}

function organizationOptionId(o: Record<string, unknown>): string {
  return String(o.id ?? o.org_id ?? '');
}

function organizationOptionLabel(o: Record<string, unknown>): string {
  const n = o.organization_name ?? o.name ?? o.legal_name ?? o.org_name;
  if (typeof n === 'string' && n.trim()) return n;
  const id = organizationOptionId(o);
  return id || 'Organization';
}

function siteOptionLabel(s: Record<string, unknown>): string {
  const n = s.site_name ?? s.name;
  if (typeof n === 'string' && n.trim()) return n;
  return String(s.id ?? '');
}

function useUserFormOrganizations() {
  const { config } = useAuth();
  return useQuery({
    queryKey: ['user-form-orgs', config?.token],
    enabled: !!config,
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const raw = await apiGet(config, '/v1/admin/organizations?page=1&pageSize=200');
      return normalizeListPayload<Record<string, unknown>>(raw);
    },
  });
}

function useUserFormSites(organizationId: string) {
  const { config } = useAuth();
  return useQuery({
    queryKey: ['user-form-sites', organizationId, config?.token],
    enabled: !!config && !!organizationId,
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const raw = await apiGet(
        config,
        `/v1/admin/sites?page=1&pageSize=200&organizationId=${encodeURIComponent(organizationId)}`
      );
      return normalizeListPayload<Record<string, unknown>>(raw);
    },
  });
}

type UserForm = {
  organization_id: string; full_name: string; email: string; mobile: string; department: string;
  user_status: string; login_allowed: boolean; login_email: string; password: string; force_password_change: boolean;
  mfa_required: boolean; allowed_login_platform: string; role_id: string; role_code: string;
  assigned_site_ids_csv: string; primary_site_id: string; assigned_camera_ids_csv: string;
  receive_alerts: boolean; alert_channels_csv: string; alert_priority_levels_csv: string;
  daily_summary_required: boolean; weekly_summary_required: boolean; remarks: string;
};

const emptyUser: UserForm = {
  organization_id:'', full_name:'', email:'', mobile:'', department:'', user_status:'Invited', login_allowed:true,
  login_email:'', password:'AutoGenerate', force_password_change:true, mfa_required:false, allowed_login_platform:'Web Dashboard',
  role_id:'', role_code:'ROLE_OPERATOR', assigned_site_ids_csv:'', primary_site_id:'', assigned_camera_ids_csv:'',
  receive_alerts:true, alert_channels_csv:'Dashboard,Email', alert_priority_levels_csv:'High,Critical',
  daily_summary_required:false, weekly_summary_required:false, remarks:'',
};

function validate(v: UserForm) {
  const e: Record<string,string> = {};
  if (!v.organization_id) e.organization_id='Organization is required.';
  if (!v.full_name.trim() || v.full_name.trim().length < 2) e.full_name='Full name is required.';
  if (!EMAIL_RE.test(v.email)) e.email='Invalid email address.';
  if (!MOBILE_RE.test(v.mobile)) e.mobile='Please enter a valid mobile number.';
  if (!v.role_id) e.role_id = 'Role is required.';
  if (v.role_code !== 'ROLE_ORG_ADMIN' && !splitCsv(v.assigned_site_ids_csv).length && !v.primary_site_id.trim()) {
    e.assigned_site_ids_csv = 'Site is required for this role.';
  }
  return e;
}

function toPayload(v: UserForm) {
  return {
    organization_id: v.organization_id,
    full_name: v.full_name.trim(),
    email: v.email.trim().toLowerCase(),
    mobile: v.mobile.trim(),
    department: v.department || null,
    user_status: v.user_status,
    login_allowed: v.login_allowed,
    login_email: (v.login_email || v.email).trim().toLowerCase(),
    password: v.password || 'AutoGenerate',
    force_password_change: v.force_password_change,
    mfa_required: v.mfa_required,
    allowed_login_platform: v.allowed_login_platform,
    role_id: v.role_id,
    role_code: v.role_code,
    assigned_site_ids: splitCsv(v.assigned_site_ids_csv),
    primary_site_id: v.primary_site_id || null,
    assigned_camera_ids: splitCsv(v.assigned_camera_ids_csv),
    receive_alerts: v.receive_alerts,
    alert_channels: splitCsv(v.alert_channels_csv),
    alert_priority_levels: splitCsv(v.alert_priority_levels_csv),
    daily_summary_required: v.daily_summary_required,
    weekly_summary_required: v.weekly_summary_required,
    remarks: v.remarks || null,
  };
}

function useRolesPermissions() {
  const { config } = useAuth();
  const roles = useQuery({ queryKey:['v3-roles',config?.token], enabled:!!config, queryFn: async()=> {
    const raw = await apiGet(config!, '/v1/admin/roles');
    return Array.isArray((raw as any)?.data) ? (raw as any).data.map(parseRole) : [];
  }});
  const permissions = useQuery({ queryKey:['v3-permissions',config?.token], enabled:!!config, queryFn: async()=> {
    const raw = await apiGet(config!, '/v1/admin/permissions');
    return Array.isArray((raw as any)?.data) ? (raw as any).data.map(parsePermission) : [];
  }});
  return { roles, permissions };
}

export function UsersListPageV2() {
  const base = useAdminBasePath();
  const { user, config } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [search,setSearch]=useState(''); const [roleId,setRoleId]=useState(''); const [department,setDepartment]=useState(''); const [status,setStatus]=useState('');
  const { roles } = useRolesPermissions();
  const list = useQuery({ queryKey:['v3-users',search,roleId,department,status,config?.token], enabled:!!config, queryFn: async()=> {
    const p=new URLSearchParams({page:'1',limit:'50'}); if(search)p.set('search',search); if(roleId)p.set('roleId',roleId); if(department)p.set('department',department); if(status)p.set('status',status);
    const raw = await apiGet(config!, `/v1/admin/users?${p.toString()}`); return Array.isArray((raw as any)?.data) ? (raw as any).data.map(parseUser) : [];
  }});
  const del = useMutation({ mutationFn: async(id:string)=> apiDelete(config!, `/v1/admin/users/${id}`), onSuccess: ()=>qc.invalidateQueries({queryKey:['v3-users']}) });
  const reset = useMutation({ mutationFn: async(id:string)=> apiPost(config!, `/v1/admin/users/${id}/reset-password`, {}) });
  const invite = useMutation({ mutationFn: async(id:string)=> apiPost(config!, `/v1/admin/users/${id}/invite`, {}), onSuccess: ()=>qc.invalidateQueries({queryKey:['v3-users']}) });
  if (!user?.role || !['superadmin','org_admin','site_admin'].includes(user.role)) return <AccessDenied />;
  return <div className='space-y-5'>
    <div className='flex items-center justify-between'><h1 className='text-xl font-semibold text-slate-100'>User Management</h1><div className='flex gap-2'><Button variant='outline' onClick={()=>router.push(`${base}/users/bulk`)}>Bulk Add Users</Button><Button onClick={()=>router.push(`${base}/users/new`)}>Add User</Button></div></div>
    <Card className='border-slate-800'><CardContent className='grid gap-3 p-4 sm:grid-cols-4'><input className='rounded-md border border-slate-700 bg-slate-900 p-2 text-sm' placeholder='Search name/email/mobile' value={search} onChange={(e)=>setSearch(e.target.value)} /><select className='rounded-md border border-slate-700 bg-slate-900 p-2 text-sm' value={roleId} onChange={(e)=>setRoleId(e.target.value)}><option value=''>Role</option>{(roles.data||[]).map((r:any)=><option key={r.id} value={r.id}>{r.role_name}</option>)}</select><select className='rounded-md border border-slate-700 bg-slate-900 p-2 text-sm' value={department} onChange={(e)=>setDepartment(e.target.value)}><option value=''>Department</option>{DEPARTMENTS.map((d)=><option key={d} value={d}>{d}</option>)}</select><select className='rounded-md border border-slate-700 bg-slate-900 p-2 text-sm' value={status} onChange={(e)=>setStatus(e.target.value)}><option value=''>Status</option>{USER_STATUSES.map((s)=><option key={s} value={s}>{s}</option>)}</select></CardContent></Card>
    <Card className='border-slate-800'><CardContent className='p-0 overflow-x-auto'>{list.isLoading ? <div className='p-4 text-sm text-slate-400'>Loading users...</div> : null}{!list.isLoading && !(list.data||[]).length ? <div className='p-4 text-sm text-slate-400'>No users found.</div> : null}{(list.data||[]).length ? <table className='w-full text-sm'><thead className='bg-slate-900/80 text-slate-300'><tr><th className='px-3 py-2 text-left'>Full Name</th><th className='px-3 py-2 text-left'>Email</th><th className='px-3 py-2 text-left'>Mobile</th><th className='px-3 py-2 text-left'>Role</th><th className='px-3 py-2 text-left'>Assigned Sites</th><th className='px-3 py-2 text-left'>Status</th><th className='px-3 py-2 text-left'>Login Allowed</th><th className='px-3 py-2 text-left'>Actions</th></tr></thead><tbody>{(list.data||[]).map((u:any)=><tr key={u.id} className='border-t border-slate-800'><td className='px-3 py-2 text-slate-100'>{u.full_name}</td><td className='px-3 py-2 text-slate-300'>{u.email}</td><td className='px-3 py-2 text-slate-300'>{u.mobile}</td><td className='px-3 py-2 text-slate-400'>{u.role_name || '-'}</td><td className='px-3 py-2 text-slate-400'>{u.assigned_sites?.length || 0}</td><td className='px-3 py-2'><UserStatusBadge status={u.user_status} /></td><td className='px-3 py-2 text-slate-300'>{u.login_allowed ? 'Yes' : 'No'}</td><td className='px-3 py-2'><div className='flex flex-wrap gap-2'><Button size='sm' variant='outline' onClick={()=>router.push(`${base}/users/${u.id}`)}>View</Button><Button size='sm' variant='outline' onClick={()=>router.push(`${base}/users/${u.id}/edit`)}>Edit</Button><Button size='sm' variant='outline' onClick={()=>reset.mutate(u.id)}>Reset Password</Button><Button size='sm' variant='outline' onClick={()=>invite.mutate(u.id)}>Invite</Button><Button size='sm' variant='destructive' onClick={()=>del.mutate(u.id)}>Disable</Button></div></td></tr>)}</tbody></table> : null}</CardContent></Card>
  </div>;
}

function UserFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const base = useAdminBasePath();
  const { user, config } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const id = mode === 'edit' ? params?.id : undefined;
  const detailQ = useQuery({
    queryKey: ['v3-user', id, config?.token],
    enabled: !!config && mode === 'edit' && !!id,
    queryFn: async () => (await apiGet(config!, `/v1/admin/users/${id}`) as any).user,
  });
  const { roles } = useRolesPermissions();
  const orgQ = useUserFormOrganizations();
  const qc = useQueryClient();
  const [v, setV] = useState<UserForm>(emptyUser);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const sitesQ = useUserFormSites(v.organization_id);

  useEffect(() => {
    if (mode !== 'create') return;
    const oid = searchParams.get('organizationId');
    if (!oid) return;
    setV((prev) => {
      if (prev.organization_id) return prev;
      return { ...prev, organization_id: oid };
    });
  }, [mode, searchParams]);

  useEffect(() => {
    if (mode !== 'create') return;
    const sid = searchParams.get('siteId');
    if (!sid) return;
    setV((prev) => {
      if (prev.assigned_site_ids_csv || prev.primary_site_id) return prev;
      return { ...prev, assigned_site_ids_csv: sid, primary_site_id: sid };
    });
  }, [mode, searchParams]);

  if (mode === 'edit' && detailQ.data && v.full_name === '') {
    const d: any = detailQ.data;
    setV((p) => ({
      ...p,
      organization_id: d.organization_id || '',
      full_name: d.full_name || '',
      email: d.email || '',
      mobile: d.mobile || '',
      department: d.department || '',
      user_status: d.user_status || 'Invited',
      login_allowed: Boolean(d.login_allowed),
      login_email: d.login_email || d.email || '',
      role_id: d.site_access?.[0]?.role_id || '',
      role_code: d.site_access?.[0]?.role_name
        ? `ROLE_${String(d.site_access[0].role_name).toUpperCase().replace(/\s+/g, '_')}`
        : 'ROLE_OPERATOR',
      assigned_site_ids_csv: Array.isArray(d.site_access) ? d.site_access.map((x: any) => x.site_id).join(',') : '',
      primary_site_id: Array.isArray(d.site_access)
        ? d.site_access.find((x: any) => x.is_primary_site)?.site_id || ''
        : '',
      assigned_camera_ids_csv: Array.isArray(d.camera_access)
        ? d.camera_access.map((x: any) => x.camera_id).join(',')
        : '',
      remarks: d.remarks || '',
    }));
  }

  const save = useMutation({
    mutationFn: async () =>
      mode === 'create'
        ? apiPost(config!, '/v1/admin/users', toPayload(v))
        : apiPut(config!, `/v1/admin/users/${id}`, toPayload(v)),
    onSuccess: async (raw) => {
      await qc.invalidateQueries({ queryKey: ['v3-users'] });
      await qc.invalidateQueries({ queryKey: ['org-detail-users'] });
      await qc.invalidateQueries({ queryKey: ['site-view-users'] });
      router.push(`${base}/users/${(raw as any)?.id || id}`);
    },
  });

  if (!user?.role || !['superadmin', 'org_admin', 'site_admin'].includes(user.role)) return <AccessDenied />;

  const orgRows = orgQ.data ?? [];
  const siteRows = sitesQ.data ?? [];
  const selectedSiteId = v.primary_site_id.trim() || splitCsv(v.assigned_site_ids_csv)[0] || '';
  const siteOptional = v.role_code === 'ROLE_ORG_ADMIN';

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const er = validate(v);
    setErrors(er);
    if (Object.keys(er).length) return;
    save.mutate();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">{mode === 'create' ? 'Add User' : 'Edit User'}</h1>
        <Button variant="outline" onClick={() => router.push(`${base}/users`)}>
          Back
        </Button>
      </div>
      <form className="space-y-4" onSubmit={onSubmit}>
        {mode === 'create' ? (
          <Card className="border-slate-800">
            <CardHeader>
              <CardTitle className="text-base text-slate-100">New user</CardTitle>
              <p className="text-sm text-slate-400">
                Invite defaults: auto-generated password, login email matches work email, dashboard access.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-slate-200 sm:col-span-2">
                Organization <span className="text-rose-400">*</span>
                <select
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
                  value={v.organization_id}
                  onChange={(e) => {
                    const nextOrg = e.target.value;
                    setV((x) => ({
                      ...x,
                      organization_id: nextOrg,
                      assigned_site_ids_csv: '',
                      primary_site_id: '',
                    }));
                  }}
                >
                  <option value="">Select organization</option>
                  {orgRows.map((o) => {
                    const oid = organizationOptionId(o);
                    return (
                      <option key={oid} value={oid}>
                        {organizationOptionLabel(o)}
                      </option>
                    );
                  })}
                </select>
                {errors.organization_id ? <p className="mt-1 text-xs text-rose-400">{errors.organization_id}</p> : null}
              </label>
              <label className="text-sm text-slate-200 sm:col-span-2">
                Site / location {siteOptional ? <span className="text-slate-500">(optional for org admin)</span> : <span className="text-rose-400">*</span>}
                <select
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
                  disabled={!v.organization_id || sitesQ.isLoading}
                  value={selectedSiteId}
                  onChange={(e) => {
                    const sid = e.target.value;
                    setV((x) => ({
                      ...x,
                      assigned_site_ids_csv: sid,
                      primary_site_id: sid,
                    }));
                  }}
                >
                  <option value="">{v.organization_id ? 'Select site' : 'Choose an organization first'}</option>
                  {siteRows.map((s) => {
                    const sid = String(s.id ?? '');
                    return (
                      <option key={sid} value={sid}>
                        {siteOptionLabel(s)}
                      </option>
                    );
                  })}
                </select>
                {errors.assigned_site_ids_csv ? <p className="mt-1 text-xs text-rose-400">{errors.assigned_site_ids_csv}</p> : null}
              </label>
              <label className="text-sm text-slate-200">
                Full name <span className="text-rose-400">*</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
                  placeholder="Full name"
                  value={v.full_name}
                  onChange={(e) => setV((x) => ({ ...x, full_name: e.target.value }))}
                />
                {errors.full_name ? <p className="mt-1 text-xs text-rose-400">{errors.full_name}</p> : null}
              </label>
              <label className="text-sm text-slate-200">
                Email <span className="text-rose-400">*</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
                  placeholder="name@company.com"
                  type="email"
                  autoComplete="email"
                  value={v.email}
                  onChange={(e) => setV((x) => ({ ...x, email: e.target.value }))}
                />
                {errors.email ? <p className="mt-1 text-xs text-rose-400">{errors.email}</p> : null}
              </label>
              <label className="text-sm text-slate-200">
                Contact number <span className="text-rose-400">*</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
                  placeholder="10 digits, starts with 6-9"
                  inputMode="numeric"
                  value={v.mobile}
                  onChange={(e) => setV((x) => ({ ...x, mobile: e.target.value }))}
                />
                {errors.mobile ? <p className="mt-1 text-xs text-rose-400">{errors.mobile}</p> : null}
              </label>
              <label className="text-sm text-slate-200">
                Role <span className="text-rose-400">*</span>
                <select
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
                  value={v.role_id}
                  onChange={(e) => {
                    const rid = e.target.value;
                    const role = (roles.data || []).find((r: any) => r.id === rid);
                    setV((x) => ({ ...x, role_id: rid, role_code: role?.role_code || x.role_code }));
                  }}
                >
                  <option value="">Select role</option>
                  {(roles.data || []).map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.role_name}
                    </option>
                  ))}
                </select>
                {errors.role_id ? <p className="mt-1 text-xs text-rose-400">{errors.role_id}</p> : null}
              </label>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-slate-800">
              <CardHeader>
                <CardTitle className="text-base text-slate-100">Basic User Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <input
                  className="rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
                  placeholder="Organization"
                  value={v.organization_id}
                  onChange={(e) => setV((x) => ({ ...x, organization_id: e.target.value }))}
                />
                <input
                  className="rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
                  placeholder="Full Name"
                  value={v.full_name}
                  onChange={(e) => setV((x) => ({ ...x, full_name: e.target.value }))}
                />
                <input
                  className="rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
                  placeholder="Email Address"
                  value={v.email}
                  onChange={(e) => setV((x) => ({ ...x, email: e.target.value }))}
                />
                <input
                  className="rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
                  placeholder="Primary Contact Number"
                  value={v.mobile}
                  onChange={(e) => setV((x) => ({ ...x, mobile: e.target.value }))}
                />
                <select
                  className="rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
                  value={v.department}
                  onChange={(e) => setV((x) => ({ ...x, department: e.target.value }))}
                >
                  <option value="">Department</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
                  value={v.user_status}
                  onChange={(e) => setV((x) => ({ ...x, user_status: e.target.value }))}
                >
                  {USER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </CardContent>
            </Card>
            <Card className="border-slate-800">
              <CardHeader>
                <CardTitle className="text-base text-slate-100">Login Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-slate-200">
                  Login Allowed?
                  <input
                    type="checkbox"
                    className="ml-2"
                    checked={v.login_allowed}
                    onChange={(e) => setV((x) => ({ ...x, login_allowed: e.target.checked }))}
                  />
                </label>
                <input
                  className="rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
                  placeholder="Login Email"
                  value={v.login_email}
                  onChange={(e) => setV((x) => ({ ...x, login_email: e.target.value }))}
                />
                <input
                  className="rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
                  placeholder="Password"
                  value={v.password}
                  onChange={(e) => setV((x) => ({ ...x, password: e.target.value }))}
                />
                <label className="text-sm text-slate-200">
                  Force Password Change?
                  <input
                    type="checkbox"
                    className="ml-2"
                    checked={v.force_password_change}
                    onChange={(e) => setV((x) => ({ ...x, force_password_change: e.target.checked }))}
                  />
                </label>
                <label className="text-sm text-slate-200">
                  MFA Required?
                  <input
                    type="checkbox"
                    className="ml-2"
                    checked={v.mfa_required}
                    onChange={(e) => setV((x) => ({ ...x, mfa_required: e.target.checked }))}
                  />
                </label>
                <select
                  className="rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
                  value={v.allowed_login_platform}
                  onChange={(e) => setV((x) => ({ ...x, allowed_login_platform: e.target.value }))}
                >
                  {LOGIN_PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </CardContent>
            </Card>
            <Card className="border-slate-800">
              <CardHeader>
                <CardTitle className="text-base text-slate-100">Role & Site Access</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <select
                  className="rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
                  value={v.role_id}
                  onChange={(e) => {
                    const rid = e.target.value;
                    const role = (roles.data || []).find((r: any) => r.id === rid);
                    setV((x) => ({ ...x, role_id: rid, role_code: role?.role_code || x.role_code }));
                  }}
                >
                  <option value="">Role</option>
                  {(roles.data || []).map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.role_name}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
                  placeholder="Assigned Sites (comma separated)"
                  value={v.assigned_site_ids_csv}
                  onChange={(e) => setV((x) => ({ ...x, assigned_site_ids_csv: e.target.value }))}
                />
                <input
                  className="rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
                  placeholder="Primary Site"
                  value={v.primary_site_id}
                  onChange={(e) => setV((x) => ({ ...x, primary_site_id: e.target.value }))}
                />
                <input
                  className="rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
                  placeholder="Assigned Cameras (comma separated)"
                  value={v.assigned_camera_ids_csv}
                  onChange={(e) => setV((x) => ({ ...x, assigned_camera_ids_csv: e.target.value }))}
                />
              </CardContent>
            </Card>
          </>
        )}
        {Object.keys(errors).length ? (
          <Card className="border-rose-700 bg-rose-900/20">
            <CardContent className="p-3 text-sm text-rose-200">{Object.values(errors)[0]}</CardContent>
          </Card>
        ) : null}
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving...' : 'Save User'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

export function UserCreatePageV2(){ return <UserFormPage mode='create' />; }
export function UserEditPageV2(){ return <UserFormPage mode='edit' />; }

export function UserBulkPageV2() {
  const base = useAdminBasePath();
  const { user, config } = useAuth();
  const router = useRouter();
  const [organizationId,setOrganizationId]=useState(''); const [siteId,setSiteId]=useState('');
  const [rows,setRows]=useState([{fullName:'',email:'',mobile:'',password:'AutoGenerate',roleId:'',roleCode:'ROLE_OPERATOR',department:'Security',designation:'Operator'}]);
  const bulk=useMutation({ mutationFn: async()=> apiPost(config!, '/v1/admin/users/bulk', { organization_id: organizationId, site_id: siteId, users: rows.map(r=>({ full_name:r.fullName, email:r.email, mobile:r.mobile, password:r.password, role_id:r.roleId, role_code:r.roleCode, department:r.department, designation:r.designation })) }) });
  if (!user?.role || !['superadmin','org_admin','site_admin'].includes(user.role)) return <AccessDenied />;
  return <div className='space-y-5'><div className='flex items-center justify-between'><h1 className='text-xl font-semibold text-slate-100'>Bulk Add Users</h1><Button variant='outline' onClick={()=>router.push(`${base}/users`)}>Back</Button></div><Card className='border-slate-800'><CardContent className='grid gap-3 p-4 sm:grid-cols-2'><input className='rounded-md border border-slate-700 bg-slate-900 p-2 text-sm' placeholder='Organization ID' value={organizationId} onChange={(e)=>setOrganizationId(e.target.value)} /><input className='rounded-md border border-slate-700 bg-slate-900 p-2 text-sm' placeholder='Site ID' value={siteId} onChange={(e)=>setSiteId(e.target.value)} /></CardContent></Card><Card className='border-slate-800'><CardContent className='p-4 overflow-x-auto'><table className='w-full text-sm'><thead><tr className='text-slate-300'><th className='px-2 py-1 text-left'>Full Name</th><th className='px-2 py-1 text-left'>Email</th><th className='px-2 py-1 text-left'>Mobile</th><th className='px-2 py-1 text-left'>Password</th><th className='px-2 py-1 text-left'>Role ID</th><th className='px-2 py-1 text-left'>Department</th><th className='px-2 py-1 text-left'>Designation</th></tr></thead><tbody>{rows.map((r,idx)=><tr key={idx} className='border-t border-slate-800'><td className='px-2 py-1'><input className='w-full rounded-md border border-slate-700 bg-slate-900 p-2' value={r.fullName} onChange={(e)=>setRows(x=>x.map((y,i)=>i===idx?{...y,fullName:e.target.value}:y))} /></td><td className='px-2 py-1'><input className='w-full rounded-md border border-slate-700 bg-slate-900 p-2' value={r.email} onChange={(e)=>setRows(x=>x.map((y,i)=>i===idx?{...y,email:e.target.value}:y))} /></td><td className='px-2 py-1'><input className='w-full rounded-md border border-slate-700 bg-slate-900 p-2' value={r.mobile} onChange={(e)=>setRows(x=>x.map((y,i)=>i===idx?{...y,mobile:e.target.value}:y))} /></td><td className='px-2 py-1'><input className='w-full rounded-md border border-slate-700 bg-slate-900 p-2' value={r.password} onChange={(e)=>setRows(x=>x.map((y,i)=>i===idx?{...y,password:e.target.value}:y))} /></td><td className='px-2 py-1'><input className='w-full rounded-md border border-slate-700 bg-slate-900 p-2' value={r.roleId} onChange={(e)=>setRows(x=>x.map((y,i)=>i===idx?{...y,roleId:e.target.value}:y))} /></td><td className='px-2 py-1'><input className='w-full rounded-md border border-slate-700 bg-slate-900 p-2' value={r.department} onChange={(e)=>setRows(x=>x.map((y,i)=>i===idx?{...y,department:e.target.value}:y))} /></td><td className='px-2 py-1'><input className='w-full rounded-md border border-slate-700 bg-slate-900 p-2' value={r.designation} onChange={(e)=>setRows(x=>x.map((y,i)=>i===idx?{...y,designation:e.target.value}:y))} /></td></tr>)}</tbody></table><div className='mt-3 flex gap-2'><Button variant='outline' onClick={()=>setRows(x=>[...x,{fullName:'',email:'',mobile:'',password:'AutoGenerate',roleId:'',roleCode:'ROLE_OPERATOR',department:'Security',designation:'Operator'}])}>Add Another User</Button><Button onClick={()=>bulk.mutate()} disabled={bulk.isPending}>{bulk.isPending?'Creating...':'Create Users'}</Button></div></CardContent></Card></div>;
}

export function UserViewPageV2() {
  const base = useAdminBasePath();
  const { user, config } = useAuth();
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const q = useQuery({ queryKey:['v3-user-view',id,config?.token], enabled:!!config && !!id, queryFn: async()=> (await apiGet(config!, `/v1/admin/users/${id}`) as any).user });
  if (!user?.role || !['superadmin','org_admin','site_admin','operator','site_viewer'].includes(user.role)) return <AccessDenied />;
  if (q.isLoading) return <div className='text-sm text-slate-400'>Loading...</div>;
  const d:any = q.data;
  return <div className='space-y-5'><div className='flex items-center justify-between'><div><h1 className='text-xl font-semibold text-slate-100'>{d?.full_name || 'User Details'}</h1><p className='text-sm text-slate-400'>{d?.email || ''}</p></div><Button variant='outline' onClick={()=>router.push(`${base}/users`)}>Back</Button></div><Card className='border-slate-800'><CardHeader className='py-3'><CardTitle className='text-base text-slate-100'>Tabs</CardTitle></CardHeader><CardContent><div className='flex flex-wrap gap-2'>{['Overview','Site Access','Camera Access','Notifications','Activity Logs','Audit Logs'].map((t)=><span key={t} className={`rounded-md px-3 py-1 text-sm ${t==='Overview'||t==='Site Access'?'bg-blue-600 text-white':'bg-slate-800 text-slate-300'}`}>{t}</span>)}</div></CardContent></Card><Card className='border-slate-800'><CardHeader className='py-3'><CardTitle className='text-base text-slate-100'>Overview</CardTitle></CardHeader><CardContent className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'><div className='rounded-md border border-slate-800 p-3'><p className='text-xs text-slate-500'>Full Name</p><p className='text-sm text-slate-100'>{d?.full_name || '-'}</p></div><div className='rounded-md border border-slate-800 p-3'><p className='text-xs text-slate-500'>Email</p><p className='text-sm text-slate-100'>{d?.email || '-'}</p></div><div className='rounded-md border border-slate-800 p-3'><p className='text-xs text-slate-500'>Mobile</p><p className='text-sm text-slate-100'>{d?.mobile || '-'}</p></div><div className='rounded-md border border-slate-800 p-3'><p className='text-xs text-slate-500'>Organization</p><p className='text-sm text-slate-100'>{d?.organization_name || '-'}</p></div><div className='rounded-md border border-slate-800 p-3'><p className='text-xs text-slate-500'>Status</p><p className='text-sm text-slate-100'>{d?.user_status || '-'}</p></div></CardContent></Card><Card className='border-slate-800'><CardHeader className='py-3'><CardTitle className='text-base text-slate-100'>Site Access</CardTitle></CardHeader><CardContent className='space-y-2'>{Array.isArray(d?.site_access) && d.site_access.length ? d.site_access.map((x:any)=><div key={x.id} className='rounded-md border border-slate-800 p-3 text-sm text-slate-300'>{x.site_name} • {x.role_name} {x.is_primary_site ? '(Primary)' : ''}</div>) : <p className='text-sm text-slate-500'>No site access found.</p>}</CardContent></Card></div>;
}

export function RolesPageV2() {
  const base = useAdminBasePath();
  const { user, config } = useAuth();
  const { roles, permissions } = useRolesPermissions();
  const router = useRouter();
  const qc = useQueryClient();
  const createRole = useMutation({ mutationFn: async()=> apiPost(config!, '/v1/admin/roles', { role_name:'Custom Role', role_code:`ROLE_CUSTOM_${Date.now()}`, role_level:'Site', role_status:'Active' }), onSuccess: ()=>qc.invalidateQueries({queryKey:['v3-roles']}) });
  if (!user?.role || !['superadmin','org_admin'].includes(user.role)) return <AccessDenied />;
  return <div className='space-y-5'><div className='flex items-center justify-between'><h1 className='text-xl font-semibold text-slate-100'>Role Master</h1><Button onClick={()=>createRole.mutate()} disabled={createRole.isPending}>{createRole.isPending?'Creating...':'Create Role'}</Button></div><Card className='border-slate-800'><CardHeader className='py-3'><CardTitle className='text-base text-slate-100'>Roles</CardTitle></CardHeader><CardContent className='space-y-2'>{(roles.data||[]).map((r:any)=><div key={r.id} className='rounded-md border border-slate-800 p-3 flex items-center justify-between'><div><p className='text-sm text-slate-100'>{r.role_name}</p><p className='text-xs text-slate-500'>{r.role_code} • {r.role_level}</p></div><Button size='sm' variant='outline' onClick={()=>router.push(`${base}/roles/${r.id}/permissions`)}>Permissions</Button></div>)}</CardContent></Card><Card className='border-slate-800'><CardHeader className='py-3'><CardTitle className='text-base text-slate-100'>Permission Master</CardTitle></CardHeader><CardContent className='space-y-2'>{(permissions.data||[]).slice(0,20).map((p:any)=><div key={p.id} className='rounded-md border border-slate-800 p-3'><p className='text-sm text-slate-100'>{p.permission_name}</p><p className='text-xs text-slate-500'>{p.permission_key} • {p.permission_group}</p></div>)}</CardContent></Card></div>;
}

function rolePermRowPermissionId(row: Record<string, unknown>): string {
  const v = row.permission_id ?? row.permissionId;
  if (v == null || v === '') return '';
  return String(v);
}

export function RolePermissionsPageV2() {
  const { user, config } = useAuth();
  const { id } = useParams<{ id: string }>();
  const { permissions } = useRolesPermissions();
  const qc = useQueryClient();
  const rolePerm = useQuery({
    queryKey: ['v3-role-perm', id, config?.token],
    enabled: !!config && !!id,
    queryFn: async () => (await apiGet(config!, `/v1/admin/role-permissions/${id}`) as any).data || [],
  });
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    const rows = rolePerm.data;
    if (!Array.isArray(rows)) return;
    const ids = rows
      .map((x) => rolePermRowPermissionId(x as Record<string, unknown>))
      .filter(Boolean);
    setSelected(ids);
  }, [id, rolePerm.data]);

  const save = useMutation({
    mutationFn: async () => apiPut(config!, `/v1/admin/role-permissions/${id}`, { permissionIds: selected }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['v3-role-perm', id] });
    },
  });
  if (!user?.role || !['superadmin', 'org_admin'].includes(user.role)) return <AccessDenied />;
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-slate-100">Role Permission Matrix</h1>
      {rolePerm.isLoading ? <p className="text-sm text-slate-400">Loading role permissions…</p> : null}
      {rolePerm.isError ? (
        <p className="text-sm text-rose-400">Could not load permissions for this role. Check the network tab for the API error.</p>
      ) : null}
      <Card className="border-slate-800">
        <CardContent className="space-y-2 p-4">
          {(permissions.data || []).map((p: any) => {
            const pid = String(p.id ?? '');
            return (
              <label key={pid || p.permission_key} className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={pid ? selected.includes(pid) : false}
                  onChange={(e) =>
                    setSelected((prev) => {
                      if (!pid) return prev;
                      if (e.target.checked) return prev.includes(pid) ? prev : [...prev, pid];
                      return prev.filter((y) => y !== pid);
                    })
                  }
                />
                {p.permission_name}{' '}
                <span className="text-xs text-slate-500">({p.permission_group})</span>
              </label>
            );
          })}
        </CardContent>
      </Card>
      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? 'Saving...' : 'Save Mapping'}
      </Button>
    </div>
  );
}

export function PermissionsPageV2(){ return <RolesPageV2 />; }
