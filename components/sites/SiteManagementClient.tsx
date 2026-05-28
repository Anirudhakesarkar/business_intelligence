'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AccessDenied } from '@/components/auth/role-gate';
import { useAuth } from '@/app/providers/auth-provider';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api-client';
import { SITE_DOCUMENT_TYPES, SITE_STATUSES, SITE_TYPES, type SiteRecord, type SiteStatus } from './types';
import { parseSiteDetail, parseSiteDocuments, parseSitesList } from './contracts';
import { SiteStatusBadge } from './SiteStatusBadge';
import { useAdminBasePath } from '@/components/admin-navigation-context';
import { parseEdgeServerList } from '@/components/edge-servers/contracts';
import { EdgeServerStatusBadge } from '@/components/edge-servers/EdgeServerStatusBadge';
import type { EdgeServerRecord } from '@/components/edge-servers/types';
import { parseCameraList } from '@/components/cameras/contracts';
import { parseUser } from '@/components/user-role-permission/contracts';
import { UserStatusBadge } from '@/components/user-role-permission/UserStatusBadge';
import { formatUtcAsIst } from '@/lib/format-ist';

type SiteForm = {
  organization_id: string;
  site_name: string;
  site_code: string;
  site_type: string;
  site_status: SiteStatus;
  site_address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  google_map_link: string;
  latitude: string;
  longitude: string;
  site_contact_name: string;
  site_contact_mobile: string;
  site_contact_email: string;
  building_count: string;
  floor_count: string;
  expected_camera_count: string;
  remarks: string;
};

const emptyForm: SiteForm = {
  organization_id: '',
  site_name: '',
  site_code: '',
  site_type: '',
  site_status: 'Draft',
  site_address: '',
  city: '',
  state: '',
  country: 'India',
  pincode: '',
  google_map_link: '',
  latitude: '',
  longitude: '',
  site_contact_name: '',
  site_contact_mobile: '',
  site_contact_email: '',
  building_count: '',
  floor_count: '',
  expected_camera_count: '',
  remarks: '',
};

const MOBILE_RE = /^[6-9][0-9]{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toPayload(v: SiteForm) {
  return {
    organization_id: v.organization_id,
    site_name: v.site_name.trim(),
    site_code: v.site_code.trim().toUpperCase() || undefined,
    site_type: v.site_type,
    site_status: v.site_status,
    site_address: v.site_address.trim(),
    city: v.city.trim(),
    state: v.state.trim(),
    country: v.country.trim() || 'India',
    pincode: v.pincode.trim(),
    google_map_link: v.google_map_link || null,
    latitude: v.latitude ? Number(v.latitude) : null,
    longitude: v.longitude ? Number(v.longitude) : null,
    site_contact_name: v.site_contact_name.trim(),
    site_contact_mobile: v.site_contact_mobile.trim(),
    site_contact_email: v.site_contact_email ? v.site_contact_email.trim().toLowerCase() : null,
    building_count: v.building_count ? Number(v.building_count) : null,
    floor_count: v.floor_count ? Number(v.floor_count) : null,
    expected_camera_count: v.expected_camera_count ? Number(v.expected_camera_count) : null,
    remarks: v.remarks || null,
  };
}

function validate(v: SiteForm): Record<string,string> {
  const e: Record<string,string> = {};
  const required: (keyof SiteForm)[] = ['organization_id','site_name','site_type','site_status','site_address','city','state','country','pincode','site_contact_name','site_contact_mobile'];
  required.forEach((f)=>{ if(!String(v[f]||'').trim()) e[f]='Required'; });
  if (v.site_contact_mobile && !MOBILE_RE.test(v.site_contact_mobile)) e.site_contact_mobile = 'Invalid mobile';
  if (v.site_contact_email && !EMAIL_RE.test(v.site_contact_email)) e.site_contact_email = 'Invalid email';
  if (v.google_map_link) {
    try { new URL(v.google_map_link); } catch { e.google_map_link = 'Invalid URL'; }
  }
  return e;
}

function useSites() {
  const { config } = useAuth();
  const [search,setSearch] = useState('');
  const [status,setStatus] = useState('');
  const [siteType,setSiteType] = useState('');
  const [city,setCity] = useState('');
  const [state,setState] = useState('');
  const [organizationId,setOrganizationId] = useState('');

  const query = useQuery({
    queryKey: ['sites-admin',search,status,siteType,city,state,organizationId,config?.token],
    queryFn: async ()=> {
      if(!config) throw new Error('Not configured');
      const p = new URLSearchParams({page:'1', pageSize:'50'});
      if(search) p.set('search',search);
      if(status) p.set('status',status);
      if(siteType) p.set('siteType',siteType);
      if(city) p.set('city',city);
      if(state) p.set('state',state);
      if(organizationId) p.set('organizationId',organizationId);
      const raw = await apiGet(config, `/v1/admin/sites?${p.toString()}`);
      return parseSitesList(raw);
    },
    enabled: !!config,
  });
  return { ...query, search,setSearch,status,setStatus,siteType,setSiteType,city,setCity,state,setState,organizationId,setOrganizationId };
}

function useOrganizations() {
  const { config } = useAuth();
  return useQuery({
    queryKey: ['orgs-for-site', config?.token],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const res = await apiGet(config, '/v1/admin/organizations?page=1&pageSize=200&status=Active');
      const data = Array.isArray((res as { data?: unknown[] }).data) ? (res as { data: unknown[] }).data : [];
      return data.map((o) => {
        const x = o as { id?: string; organization_name?: string };
        return { id: String(x.id ?? ''), name: String(x.organization_name ?? '') };
      });
    },
    enabled: !!config,
  });
}

function SiteFormView({values,setValues,errors,onSubmit,submitLabel,saving,disableCodeEdit,orgOptions}:{
  values: SiteForm; setValues: React.Dispatch<React.SetStateAction<SiteForm>>; errors: Record<string,string>; onSubmit: (e: React.FormEvent)=>void; submitLabel: string; saving: boolean; disableCodeEdit?: boolean; orgOptions: {id:string;name:string}[];
}) {
  const input = 'mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100';
  const set = <K extends keyof SiteForm>(k:K,val:string)=> setValues(p=>({...p,[k]:val}));
  const err = (k:string)=> errors[k] ? <p className="mt-1 text-xs text-red-400">{errors[k]}</p> : null;
  return <form onSubmit={onSubmit} className="space-y-6">
    <Card className="border-slate-800"><CardHeader className="py-3"><CardTitle className="text-base text-slate-100">Basic Site Details</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
      <div><label className="text-sm text-slate-300">Organization *</label><select className={input} value={values.organization_id} onChange={e=>set('organization_id',e.target.value)}><option value="">Select organization</option>{orgOptions.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>{err('organization_id')}</div>
      <div><label className="text-sm text-slate-300">Site Name *</label><input className={input} value={values.site_name} onChange={e=>set('site_name',e.target.value)} />{err('site_name')}</div>
      <div><label className="text-sm text-slate-300">Site Code</label><input className={input} disabled={disableCodeEdit} value={values.site_code} onChange={e=>set('site_code',e.target.value.toUpperCase())} /></div>
      <div><label className="text-sm text-slate-300">Site Type *</label><select className={input} value={values.site_type} onChange={e=>set('site_type',e.target.value)}><option value="">Select site type</option>{SITE_TYPES.map(s=><option key={s} value={s}>{s}</option>)}</select>{err('site_type')}</div>
      <div><label className="text-sm text-slate-300">Site Status *</label><select className={input} value={values.site_status} onChange={e=>set('site_status',e.target.value as SiteStatus)}>{SITE_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
      <div><label className="text-sm text-slate-300">Expected Camera Count</label><input className={input} type="number" min={0} value={values.expected_camera_count} onChange={e=>set('expected_camera_count',e.target.value)} /></div>
    </CardContent></Card>

    <Card className="border-slate-800"><CardHeader className="py-3"><CardTitle className="text-base text-slate-100">Site Address / Location</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><label className="text-sm text-slate-300">Site Address *</label><textarea className={input} value={values.site_address} onChange={e=>set('site_address',e.target.value)} />{err('site_address')}</div>
      <div><label className="text-sm text-slate-300">City *</label><input className={input} value={values.city} onChange={e=>set('city',e.target.value)} />{err('city')}</div>
      <div><label className="text-sm text-slate-300">State *</label><input className={input} value={values.state} onChange={e=>set('state',e.target.value)} />{err('state')}</div>
      <div><label className="text-sm text-slate-300">Country *</label><input className={input} value={values.country} onChange={e=>set('country',e.target.value)} />{err('country')}</div>
      <div><label className="text-sm text-slate-300">Pincode *</label><input className={input} value={values.pincode} onChange={e=>set('pincode',e.target.value)} />{err('pincode')}</div>
      <div><label className="text-sm text-slate-300">Google Map Link</label><input className={input} value={values.google_map_link} onChange={e=>set('google_map_link',e.target.value)} />{err('google_map_link')}</div>
      <div><label className="text-sm text-slate-300">Latitude</label><input className={input} value={values.latitude} onChange={e=>set('latitude',e.target.value)} /></div>
      <div><label className="text-sm text-slate-300">Longitude</label><input className={input} value={values.longitude} onChange={e=>set('longitude',e.target.value)} /></div>
    </CardContent></Card>

    <Card className="border-slate-800"><CardHeader className="py-3"><CardTitle className="text-base text-slate-100">Site Contact & Structure</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3">
      <div><label className="text-sm text-slate-300">Site Contact Name *</label><input className={input} value={values.site_contact_name} onChange={e=>set('site_contact_name',e.target.value)} />{err('site_contact_name')}</div>
      <div><label className="text-sm text-slate-300">Site Contact Mobile *</label><input className={input} value={values.site_contact_mobile} onChange={e=>set('site_contact_mobile',e.target.value)} />{err('site_contact_mobile')}</div>
      <div><label className="text-sm text-slate-300">Site Contact Email</label><input className={input} value={values.site_contact_email} onChange={e=>set('site_contact_email',e.target.value)} />{err('site_contact_email')}</div>
      <div><label className="text-sm text-slate-300">Number of Buildings / Blocks</label><input className={input} type="number" min={0} value={values.building_count} onChange={e=>set('building_count',e.target.value)} /></div>
      <div><label className="text-sm text-slate-300">Number of Floors</label><input className={input} type="number" min={0} value={values.floor_count} onChange={e=>set('floor_count',e.target.value)} /></div>
      <div className="sm:col-span-3"><label className="text-sm text-slate-300">Remarks</label><textarea className={input} value={values.remarks} onChange={e=>set('remarks',e.target.value)} /></div>
    </CardContent></Card>

    <Button type="submit" disabled={saving}>{saving ? 'Saving...' : submitLabel}</Button>
  </form>;
}

function mapSiteToForm(s: SiteRecord): SiteForm {
  return {
    organization_id: s.organization_id,
    site_name: s.site_name,
    site_code: s.site_code,
    site_type: s.site_type,
    site_status: s.site_status,
    site_address: s.site_address,
    city: s.city,
    state: s.state,
    country: s.country,
    pincode: s.pincode,
    google_map_link: s.google_map_link ?? '',
    latitude: s.latitude != null ? String(s.latitude) : '',
    longitude: s.longitude != null ? String(s.longitude) : '',
    site_contact_name: s.site_contact_name,
    site_contact_mobile: s.site_contact_mobile,
    site_contact_email: s.site_contact_email ?? '',
    building_count: s.building_count != null ? String(s.building_count) : '',
    floor_count: s.floor_count != null ? String(s.floor_count) : '',
    expected_camera_count: s.expected_camera_count != null ? String(s.expected_camera_count) : '',
    remarks: s.remarks ?? '',
  };
}

function useSiteById(id: string | null) {
  const { config } = useAuth();
  return useQuery({
    queryKey: ['site-admin', id, config?.token],
    queryFn: async () => {
      if (!config || !id) throw new Error('Missing site id');
      const raw = await apiGet(config, `/v1/admin/sites/${id}`);
      return parseSiteDetail(raw);
    },
    enabled: !!config && !!id,
  });
}

function useSiteDocuments(id: string | null) {
  const { config } = useAuth();
  return useQuery({
    queryKey: ['site-docs', id, config?.token],
    queryFn: async () => {
      if (!config || !id) throw new Error('Missing site id');
      const raw = await apiGet(config, `/v1/admin/sites/${id}/documents`);
      return parseSiteDocuments(raw);
    },
    enabled: !!config && !!id,
  });
}

export function SitesListPage() {
  const base = useAdminBasePath();
  const { hasRole, config } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const q = useSites();

  if (!hasRole('superadmin','org_admin')) return <AccessDenied message="Only admins can manage sites." />;

  const statusMutation = useMutation({
    mutationFn: async ({id,status}:{id:string;status:SiteStatus}) => {
      if(!config) throw new Error('Not configured');
      return apiPost(config, `/v1/admin/sites/${id}/status`, { status });
    },
    onSuccess: ()=> qc.invalidateQueries({ queryKey: ['sites-admin'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id:string) => {
      if(!config) throw new Error('Not configured');
      return apiDelete(config, `/v1/admin/sites/${id}`);
    },
    onSuccess: ()=> qc.invalidateQueries({ queryKey: ['sites-admin'] }),
  });

  const sites = q.data?.data ?? [];

  return <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-bold text-slate-100">Site / Location Management</h1><p className="text-slate-400">Create and manage sites under organizations.</p></div>
      <Link href={`${base}/sites/new`}><Button>Add Site</Button></Link>
    </div>

    <Card className="border-slate-800"><CardHeader className="py-3"><CardTitle className="text-base text-slate-100">Filters</CardTitle></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-4">
        <input className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" placeholder="Search name or code" value={q.search} onChange={e=>q.setSearch(e.target.value)} />
        <input className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" placeholder="Organization ID" value={q.organizationId} onChange={e=>q.setOrganizationId(e.target.value)} />
        <select className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" value={q.siteType} onChange={e=>q.setSiteType(e.target.value)}><option value="">All site types</option>{SITE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select>
        <select className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" value={q.status} onChange={e=>q.setStatus(e.target.value)}><option value="">All statuses</option>{SITE_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select>
        <input className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" placeholder="City" value={q.city} onChange={e=>q.setCity(e.target.value)} />
        <input className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" placeholder="State" value={q.state} onChange={e=>q.setState(e.target.value)} />
      </CardContent>
    </Card>

    <Card className="border-slate-800"><CardHeader className="py-3"><CardTitle className="text-base text-slate-100">Sites ({sites.length})</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        {q.isLoading ? <p className="text-slate-400">Loading...</p> : null}
        {q.error ? <p className="text-red-400">{q.error instanceof Error ? q.error.message : 'Failed to load sites'}</p> : null}
        {!q.isLoading && !q.error && <table className="w-full min-w-[1100px] text-sm"><thead><tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
          <th className="pb-3 pr-4">Site Code</th><th className="pb-3 pr-4">Site Name</th><th className="pb-3 pr-4">Organization</th><th className="pb-3 pr-4">Site Type</th><th className="pb-3 pr-4">City / State</th><th className="pb-3 pr-4">Expected Camera Count</th><th className="pb-3 pr-4">Site Status</th><th className="pb-3 pr-4">Created Date</th><th className="pb-3 pr-4">Actions</th>
        </tr></thead><tbody>
          {sites.map((s)=> <tr key={s.id} className="border-b border-slate-800/40">
            <td className="py-3 pr-4 text-slate-300">{s.site_code}</td><td className="py-3 pr-4 text-slate-100">{s.site_name}</td><td className="py-3 pr-4 text-slate-400">{s.organization_name ?? s.organization_id}</td><td className="py-3 pr-4 text-slate-400">{s.site_type}</td><td className="py-3 pr-4 text-slate-400">{s.city} / {s.state}</td><td className="py-3 pr-4 text-slate-400">{s.expected_camera_count ?? 0}</td><td className="py-3 pr-4"><SiteStatusBadge status={s.site_status} /></td><td className="py-3 pr-4 text-slate-400">{new Date(s.created_at).toLocaleDateString()}</td>
            <td className="py-3 pr-4"><div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={()=>router.push(`${base}/sites/${s.id}`)}>View</Button>
              <Button size="sm" variant="outline" onClick={()=>router.push(`${base}/sites/${s.id}/edit`)}>Edit</Button>
              <Button size="sm" variant="outline" onClick={()=>statusMutation.mutate({id:s.id,status:'Live'})}>Mark Live</Button>
              <Button size="sm" variant="outline" onClick={()=>statusMutation.mutate({id:s.id,status:'On Hold'})}>Put On Hold</Button>
              <Button size="sm" variant="outline" onClick={()=>statusMutation.mutate({id:s.id,status:'Inactive'})}>Mark Inactive</Button>
              <Button size="sm" variant="destructive" onClick={()=>deleteMutation.mutate(s.id)}>Delete</Button>
            </div></td>
          </tr>)}
        </tbody></table>}
      </CardContent>
    </Card>
  </div>;
}

export function SiteCreatePage() {
  const base = useAdminBasePath();
  const { hasRole, config } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgQ = useOrganizations();
  const [values,setValues] = useState<SiteForm>(emptyForm);
  const [errors,setErrors] = useState<Record<string,string>>({});

  useEffect(() => {
    const oid = searchParams.get('organizationId');
    if (!oid) return;
    setValues((prev) => {
      if (prev.organization_id) return prev;
      return { ...prev, organization_id: oid };
    });
  }, [searchParams]);

  if (!hasRole('superadmin','org_admin')) return <AccessDenied message="Only admins can create sites." />;

  const mutation = useMutation({
    mutationFn: async () => {
      if(!config) throw new Error('Not configured');
      return apiPost(config, '/v1/admin/sites', toPayload(values));
    },
    onSuccess: ()=> { qc.invalidateQueries({ queryKey: ['sites-admin'] }); qc.invalidateQueries({ queryKey: ['org-detail-sites'] }); router.push(`${base}/sites`); },
  });

  return <div className="space-y-4">
    <h1 className="text-2xl font-bold text-slate-100">Add Site</h1>
    {mutation.error ? <p className="text-sm text-red-400">{mutation.error instanceof Error ? mutation.error.message : 'Failed to create site'}</p> : null}
    <SiteFormView values={values} setValues={setValues} errors={errors} onSubmit={(e)=>{e.preventDefault(); const v=validate(values); setErrors(v); if(Object.keys(v).length===0) mutation.mutate();}} submitLabel="Create Site" saving={mutation.isPending} orgOptions={orgQ.data ?? []} />
  </div>;
}

export function SiteEditPage() {
  const base = useAdminBasePath();
  const { id } = useParams<{id:string}>();
  const { hasRole, config } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const orgQ = useOrganizations();
  const q = useSiteById(id || null);
  const [local,setLocal] = useState<SiteForm>(emptyForm);
  const [errors,setErrors] = useState<Record<string,string>>({});

  if (!hasRole('superadmin','org_admin')) return <AccessDenied message="Only admins can edit sites." />;

  const serverForm = useMemo(()=> q.data?.site ? mapSiteToForm(q.data.site) : null, [q.data]);
  const values = local.site_name ? local : (serverForm ?? emptyForm);

  const mutation = useMutation({
    mutationFn: async ()=> {
      if(!config || !id) throw new Error('Not configured');
      return apiPut(config, `/v1/admin/sites/${id}`, toPayload(values));
    },
    onSuccess: ()=> { qc.invalidateQueries({queryKey:['sites-admin']}); qc.invalidateQueries({queryKey:['site-admin',id]}); router.push(`${base}/sites/${id}`); },
  });

  return <div className="space-y-4">
    <h1 className="text-2xl font-bold text-slate-100">Edit Site</h1>
    {q.isLoading ? <p className="text-slate-400">Loading...</p> : null}
    {q.error ? <p className="text-red-400">{q.error instanceof Error ? q.error.message : 'Failed to load site'}</p> : null}
    {q.data?.site ? <SiteFormView values={values} setValues={setLocal} errors={errors} onSubmit={(e)=>{e.preventDefault(); const v=validate(values); setErrors(v); if(Object.keys(v).length===0) mutation.mutate();}} submitLabel="Save Changes" saving={mutation.isPending} disableCodeEdit={!hasRole('superadmin')} orgOptions={orgQ.data ?? []} /> : null}
  </div>;
}

const SITE_DETAIL_TABS = [
  'Overview',
  'Edge Servers',
  'Users',
  'AI Rules',
  'Alerts',
  'Documents',
  'Audit Logs',
] as const;
type SiteDetailTab = (typeof SITE_DETAIL_TABS)[number];

function useSiteEdgeServers(siteId: string | undefined) {
  const { config } = useAuth();
  return useQuery({
    queryKey: ['site-view-edges', siteId, config?.token],
    queryFn: async () => {
      if (!config || !siteId) throw new Error('Not configured');
      const p = new URLSearchParams({ page: '1', limit: '200', siteId });
      const raw = await apiGet(config, `/v1/admin/edge-servers?${p.toString()}`);
      return parseEdgeServerList(raw);
    },
    enabled: !!config && !!siteId,
  });
}

function useSiteCameras(siteId: string | undefined) {
  const { config } = useAuth();
  return useQuery({
    queryKey: ['site-view-cameras', siteId, config?.token],
    queryFn: async () => {
      if (!config || !siteId) throw new Error('Not configured');
      const p = new URLSearchParams({ page: '1', limit: '200', siteId });
      const raw = await apiGet(config, `/v1/admin/cameras?${p.toString()}`);
      return parseCameraList(raw);
    },
    enabled: !!config && !!siteId,
  });
}

function useSiteUsers(siteId: string | undefined) {
  const { config } = useAuth();
  return useQuery({
    queryKey: ['site-view-users', siteId, config?.token],
    queryFn: async () => {
      if (!config || !siteId) throw new Error('Not configured');
      const p = new URLSearchParams({ page: '1', limit: '100', siteId });
      const raw = await apiGet(config, `/v1/admin/users?${p.toString()}`);
      const rows = Array.isArray((raw as { data?: unknown[] }).data) ? (raw as { data: unknown[] }).data : [];
      return rows.map(parseUser);
    },
    enabled: !!config && !!siteId,
  });
}

export function SiteViewPage() {
  const { id } = useParams<{ id: string }>();
  const { hasRole, config } = useAuth();
  const base = useAdminBasePath();
  const router = useRouter();
  const q = useSiteById(id || null);
  const docsQ = useSiteDocuments(id || null);
  const qc = useQueryClient();
  const edgesQ = useSiteEdgeServers(id);
  const camerasQ = useSiteCameras(id);
  const usersQ = useSiteUsers(id);

  const [tab, setTab] = useState<SiteDetailTab>('Overview');
  const [docType, setDocType] = useState<string>(SITE_DOCUMENT_TYPES[0]);
  const [docName, setDocName] = useState('');
  const [docUrl, setDocUrl] = useState('');

  useEffect(() => {
    setTab('Overview');
  }, [id]);

  if (!hasRole('superadmin', 'org_admin', 'site_admin')) return <AccessDenied message="Not authorized to view site." />;

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!config || !id) throw new Error('Not configured');
      return apiPost(config, `/v1/admin/sites/${id}/documents`, {
        document_type: docType,
        file_name: docName,
        file_url: docUrl,
      });
    },
    onSuccess: () => {
      setDocName('');
      setDocUrl('');
      qc.invalidateQueries({ queryKey: ['site-docs', id] });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      if (!config || !id) throw new Error('Not configured');
      return apiDelete(config, `/v1/admin/sites/${id}/documents/${docId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['site-docs', id] }),
  });

  const site = q.data?.site;
  const docs = docsQ.data?.documents ?? [];
  const edges = edgesQ.data?.data ?? [];
  const cameras = camerasQ.data?.data ?? [];
  const users = usersQ.data ?? [];
  const onlineCameras = cameras.filter((c) => c.camera_online === true || c.online_status === 'online').length;

  return (
    <div className="space-y-6">
      {q.isLoading ? <p className="text-slate-400">Loading...</p> : null}
      {q.error ? <p className="text-red-400">{q.error instanceof Error ? q.error.message : 'Failed to load site'}</p> : null}
      {site ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-100">{site.site_name}</h1>
              <span className="text-slate-500">{site.site_code}</span>
              <SiteStatusBadge status={site.site_status} />
              <span className="text-slate-400">{site.organization_name ?? site.organization_id}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push(`${base}/sites/${site.id}/edit`)}>
              Edit site
            </Button>
          </div>

          <Card className="border-slate-800">
            <CardHeader className="py-3">
              <CardTitle className="text-base text-slate-100">Tabs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Site sections">
                {SITE_DETAIL_TABS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                      tab === t ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {tab === 'Overview' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <Card className="border-slate-800">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500">Site Status</p>
                    <p className="text-sm text-slate-100">{site.site_status}</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-800">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500">Expected Camera Count</p>
                    <p className="text-sm text-slate-100">{site.expected_camera_count ?? 0}</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-800">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500">Total Edge Servers</p>
                    <p className="text-sm text-slate-100">{edgesQ.isLoading ? '…' : edges.length}</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-800">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500">Total Cameras</p>
                    <p className="text-sm text-slate-100">{camerasQ.isLoading ? '…' : cameras.length}</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-800">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500">Online Cameras</p>
                    <p className="text-sm text-slate-100">{camerasQ.isLoading ? '…' : onlineCameras}</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-800">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500">Open Alerts</p>
                    <p className="text-sm text-slate-100">—</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-slate-800">
                <CardHeader className="py-3">
                  <CardTitle className="text-base text-slate-100">Overview</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <p className="text-slate-300">
                    <span className="text-slate-500">Site Type:</span> {site.site_type}
                  </p>
                  <p className="text-slate-300">
                    <span className="text-slate-500">City / State:</span> {site.city} / {site.state}
                  </p>
                  <p className="text-slate-300 sm:col-span-2">
                    <span className="text-slate-500">Site Address:</span> {site.site_address}
                  </p>
                  <p className="text-slate-300">
                    <span className="text-slate-500">Contact:</span> {site.site_contact_name}
                  </p>
                  <p className="text-slate-300">
                    <span className="text-slate-500">Mobile:</span> {site.site_contact_mobile}
                  </p>
                  <p className="text-slate-300">
                    <span className="text-slate-500">Email:</span> {site.site_contact_email ?? '-'}
                  </p>
                  <p className="text-slate-300">
                    <span className="text-slate-500">Buildings/Floors:</span> {site.building_count ?? 0} /{' '}
                    {site.floor_count ?? 0}
                  </p>
                  <p className="text-slate-300 sm:col-span-2">
                    <span className="text-slate-500">Remarks:</span> {site.remarks ?? '-'}
                  </p>
                </CardContent>
              </Card>
            </>
          ) : null}

          {tab === 'Edge Servers' ? (
            <Card className="border-slate-800">
              <CardHeader className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base text-slate-100">Edge servers at this site</CardTitle>
                <Button asChild size="sm">
                  <Link
                    href={`${base}/edge-servers/new?organizationId=${encodeURIComponent(site.organization_id)}&siteId=${encodeURIComponent(site.id)}`}
                  >
                    Add edge server
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {edgesQ.isLoading ? <div className="p-4 text-sm text-slate-400">Loading edge servers…</div> : null}
                {edgesQ.error ? (
                  <div className="p-4 text-sm text-red-400">
                    {edgesQ.error instanceof Error ? edgesQ.error.message : 'Failed to load edge servers'}
                  </div>
                ) : null}
                {!edgesQ.isLoading && !edgesQ.error && edges.length === 0 ? (
                  <div className="p-4 text-sm text-slate-400">No edge servers registered for this site yet.</div>
                ) : null}
                {edges.length > 0 ? (
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/80 text-left text-xs uppercase tracking-wider text-slate-500">
                        <th className="px-3 py-2">Code</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Last heartbeat (IST)</th>
                        <th className="px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {edges.map((row: EdgeServerRecord) => (
                        <tr key={row.id} className="border-b border-slate-800/60">
                          <td className="px-3 py-2 text-slate-300">{row.edge_server_code}</td>
                          <td className="px-3 py-2 text-slate-100">{row.edge_server_name}</td>
                          <td className="px-3 py-2 text-slate-400">{row.server_type}</td>
                          <td className="px-3 py-2">
                            <EdgeServerStatusBadge status={row.server_status} />
                          </td>
                          <td className="px-3 py-2 text-slate-400">{formatUtcAsIst(row.last_heartbeat_time)}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => router.push(`${base}/edge-servers/${row.id}`)}>
                                View
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => router.push(`${base}/edge-servers/${row.id}/edit`)}>
                                Edit
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {tab === 'Users' ? (
            <Card className="border-slate-800">
              <CardHeader className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base text-slate-100">Users with access to this site</CardTitle>
                <Button asChild size="sm">
                  <Link
                    href={`${base}/users/new?organizationId=${encodeURIComponent(site.organization_id)}&siteId=${encodeURIComponent(site.id)}`}
                  >
                    Add user
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {usersQ.isLoading ? <div className="p-4 text-sm text-slate-400">Loading users…</div> : null}
                {usersQ.error ? (
                  <div className="p-4 text-sm text-red-400">
                    {usersQ.error instanceof Error ? usersQ.error.message : 'Failed to load users'}
                  </div>
                ) : null}
                {!usersQ.isLoading && !usersQ.error && users.length === 0 ? (
                  <div className="p-4 text-sm text-slate-400">No users found for this site.</div>
                ) : null}
                {users.length > 0 ? (
                  <table className="w-full min-w-[800px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/80 text-left text-xs uppercase tracking-wider text-slate-500">
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Role</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-slate-800/60">
                          <td className="px-3 py-2 text-slate-100">{u.full_name}</td>
                          <td className="px-3 py-2 text-slate-300">{u.email}</td>
                          <td className="px-3 py-2 text-slate-400">{u.role_name ?? '—'}</td>
                          <td className="px-3 py-2">
                            <UserStatusBadge status={u.user_status} />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => router.push(`${base}/users/${u.id}`)}>
                                View
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => router.push(`${base}/users/${u.id}/edit`)}>
                                Edit
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {tab === 'AI Rules' || tab === 'Alerts' || tab === 'Audit Logs' ? (
            <Card className="border-slate-800">
              <CardHeader className="py-3">
                <CardTitle className="text-base text-slate-100">{tab}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500">This section is not wired in the site admin UI yet.</p>
              </CardContent>
            </Card>
          ) : null}

          {tab === 'Documents' ? (
            <Card className="border-slate-800">
              <CardHeader className="py-3">
                <CardTitle className="text-base text-slate-100">Documents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <select
                    className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                  >
                    {SITE_DOCUMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <input
                    className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                    placeholder="File name"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                  />
                  <input
                    className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                    placeholder="File URL"
                    value={docUrl}
                    onChange={(e) => setDocUrl(e.target.value)}
                  />
                  <Button onClick={() => uploadMutation.mutate()} disabled={!docName || !docUrl || uploadMutation.isPending}>
                    {uploadMutation.isPending ? 'Uploading...' : 'Upload Document'}
                  </Button>
                </div>
                {docsQ.isLoading ? <p className="text-slate-400">Loading documents...</p> : null}
                {docsQ.error ? (
                  <p className="text-red-400">{docsQ.error instanceof Error ? docsQ.error.message : 'Failed to load documents'}</p>
                ) : null}
                {docs.length === 0 ? (
                  <p className="text-slate-500">No documents uploaded yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {docs.map((d) => (
                      <li key={d.id} className="flex items-center justify-between rounded-md border border-slate-800 px-3 py-2">
                        <div>
                          <p className="text-slate-200">{d.file_name}</p>
                          <p className="text-xs text-slate-500">{d.document_type}</p>
                        </div>
                        <div className="flex gap-2">
                          <a className="text-sm text-blue-400 hover:text-blue-300" href={d.file_url} target="_blank" rel="noreferrer">
                            Open
                          </a>
                          <Button size="sm" variant="destructive" onClick={() => deleteDocMutation.mutate(d.id)}>
                            Delete
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
