'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AccessDenied } from '@/components/auth/role-gate';
import { useAuth } from '@/app/providers/auth-provider';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api-client';
import { EdgeServerStatusBadge } from './EdgeServerStatusBadge';
import { EdgeServerLicenseDialog } from './EdgeServerLicenseDialog';
import { EDGE_SERVER_STATUSES, EDGE_SERVER_TYPES, type EdgeServerRecord, type EdgeServerStatus } from './types';
import { parseEdgeHealthLogs, parseEdgeServerDetail, parseEdgeServerList } from './contracts';
import { useAdminBasePath } from '@/components/admin-navigation-context';
import { formatUtcAsIst } from '@/lib/format-ist';

type EdgeForm = {
  organization_id: string;
  site_id: string;
  edge_server_name: string;
  edge_server_code: string;
  server_type: string;
  server_status: EdgeServerStatus;
  assigned_license_id: string;
  max_camera_capacity: string;
  machine_id: string;
  hostname: string;
  local_ip_address: string;
  mac_address: string;
  public_ip_address: string;
  os_type: string;
  os_version: string;
  cpu_details: string;
  ram_gb: string;
  gpu_details: string;
  storage_capacity_gb: string;
  renderer_software_version: string;
  last_heartbeat_time: string;
  last_sync_time: string;
  remarks: string;
  /** Months until sync API key expiry (0 = no expiry). Create flow only. */
  sync_api_key_validity_months: string;
};

const emptyForm: EdgeForm = {
  organization_id: '',
  site_id: '',
  edge_server_name: '',
  edge_server_code: '',
  server_type: '',
  server_status: 'Draft',
  assigned_license_id: '',
  max_camera_capacity: '',
  machine_id: '',
  hostname: '',
  local_ip_address: '',
  mac_address: '',
  public_ip_address: '',
  os_type: '',
  os_version: '',
  cpu_details: '',
  ram_gb: '',
  gpu_details: '',
  storage_capacity_gb: '',
  renderer_software_version: '',
  last_heartbeat_time: '',
  last_sync_time: '',
  remarks: '',
  sync_api_key_validity_months: '0',
};

const MAC_RE = /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i;

/** Trims and validates dotted-decimal IPv4 (each octet 0-255). */
function isValidIpv4(raw: string): boolean {
  const s = raw.trim();
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return false;
  for (let i = 1; i <= 4; i += 1) {
    const n = Number(m[i]);
    if (!Number.isInteger(n) || n < 0 || n > 255) return false;
  }
  return true;
}

const SYNC_KEY_VALIDITY: { value: string; label: string }[] = [
  { value: '0', label: 'No expiry' },
  { value: '1', label: '1 month' },
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
  { value: '24', label: '24 months' },
];

type RendererSyncCredentials = {
  site_id: string;
  device_id: string;
  api_key: string;
  api_key_expires_at: string | null;
  api_key_issued_at: string;
};

function formToPayload(v: EdgeForm) {
  return {
    organization_id: v.organization_id,
    site_id: v.site_id,
    edge_server_name: v.edge_server_name.trim(),
    edge_server_code: v.edge_server_code.trim().toUpperCase() || undefined,
    server_type: v.server_type,
    server_status: v.server_status,
    assigned_license_id: v.assigned_license_id.trim() || null,
    machine_id: v.machine_id.trim() || null,
    hostname: v.hostname.trim() || null,
    local_ip_address: v.local_ip_address.trim() || null,
    mac_address: v.mac_address.trim() || null,
    public_ip_address: v.public_ip_address.trim() || null,
    os_type: v.os_type.trim() || null,
    os_version: v.os_version.trim() || null,
    cpu_details: v.cpu_details.trim() || null,
    ram_gb: v.ram_gb ? Number(v.ram_gb) : null,
    gpu_details: v.gpu_details.trim() || null,
    storage_capacity_gb: v.storage_capacity_gb ? Number(v.storage_capacity_gb) : null,
    renderer_software_version: v.renderer_software_version.trim() || null,
    last_heartbeat_time: v.last_heartbeat_time || null,
    last_sync_time: v.last_sync_time || null,
    remarks: v.remarks.trim() || null,
    sync_api_key_validity_months:
      v.sync_api_key_validity_months === '' ? 0 : Number(v.sync_api_key_validity_months) || 0,
  };
}

function validateForm(v: EdgeForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.organization_id.trim()) e.organization_id = 'Organization is required.';
  if (!v.site_id.trim()) e.site_id = 'Site / Location is required.';
  if (!v.edge_server_name.trim()) e.edge_server_name = 'Edge server name is required.';
  if (!v.server_type.trim()) e.server_type = 'Server type is required.';
  if (!v.server_status.trim()) e.server_status = 'Server status is required.';
  if ((v.server_status === 'Pending Activation' || v.server_status === 'Active') && !v.assigned_license_id.trim()) {
    e.assigned_license_id = 'Assigned license is required before activation.';
  }
  if (v.local_ip_address && !isValidIpv4(v.local_ip_address)) e.local_ip_address = 'Invalid local IPv4 address.';
  if (v.public_ip_address && !isValidIpv4(v.public_ip_address)) e.public_ip_address = 'Invalid public IPv4 address.';
  if (v.mac_address && !MAC_RE.test(v.mac_address.trim())) e.mac_address = 'Invalid MAC address.';
  if (v.ram_gb && Number(v.ram_gb) < 0) e.ram_gb = 'RAM GB must be zero or greater.';
  if (v.storage_capacity_gb && Number(v.storage_capacity_gb) < 0) e.storage_capacity_gb = 'Storage Capacity GB must be zero or greater.';
  return e;
}

function field(
  label: string,
  value: string | null | undefined,
  opts?: { mono?: boolean },
) {
  return (
    <div className="min-w-0 rounded-md border border-slate-800 bg-slate-900/50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-1 min-w-0 text-slate-100 ${
          opts?.mono ? 'break-all font-mono text-xs leading-relaxed' : 'break-words text-sm'
        }`}
      >
        {value?.trim() ? value : '-'}
      </p>
    </div>
  );
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

function useOrganizations() {
  const { config } = useAuth();
  return useQuery({
    queryKey: ['org-options-edge', config?.token],
    enabled: !!config,
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const raw = await apiGet(config, '/v1/admin/organizations?page=1&pageSize=200');
      return normalizeListPayload<Record<string, unknown>>(raw);
    },
  });
}

function useSites(organizationId: string) {
  const { config } = useAuth();
  return useQuery({
    queryKey: ['site-options-edge', organizationId, config?.token],
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

function useEdgeList() {
  const { config } = useAuth();
  const [search, setSearch] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [serverType, setServerType] = useState('');
  const [serverStatus, setServerStatus] = useState('');

  const query = useQuery({
    queryKey: ['edge-list', search, organizationId, siteId, serverType, serverStatus, config?.token],
    enabled: !!config,
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const p = new URLSearchParams({ page: '1', limit: '50' });
      if (search) p.set('search', search);
      if (organizationId) p.set('organizationId', organizationId);
      if (siteId) p.set('siteId', siteId);
      if (serverType) p.set('serverType', serverType);
      if (serverStatus) p.set('serverStatus', serverStatus);
      return parseEdgeServerList(await apiGet(config, `/v1/admin/edge-servers?${p.toString()}`));
    },
  });

  return {
    ...query,
    search,
    setSearch,
    organizationId,
    setOrganizationId,
    siteId,
    setSiteId,
    serverType,
    setServerType,
    serverStatus,
    setServerStatus,
  };
}

function useEdgeDetail(id: string | null) {
  const { config } = useAuth();
  return useQuery({
    queryKey: ['edge-detail', id, config?.token],
    enabled: !!config && !!id,
    queryFn: async () => {
      if (!config || !id) throw new Error('Missing params');
      return parseEdgeServerDetail(await apiGet(config, `/v1/admin/edge-servers/${id}`));
    },
  });
}

function useEdgeHealth(id: string | null) {
  const { config } = useAuth();
  return useQuery({
    queryKey: ['edge-health', id, config?.token],
    enabled: !!config && !!id,
    queryFn: async () => {
      if (!config || !id) throw new Error('Missing params');
      return parseEdgeHealthLogs(await apiGet(config, `/v1/admin/edge-servers/${id}/health-logs?page=1&limit=20`));
    },
  });
}

function EdgeServerForm({ mode }: { mode: 'create' | 'edit' }) {
  const base = useAdminBasePath();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = mode === 'edit' ? params?.id : undefined;
  const { config, user } = useAuth();
  const qc = useQueryClient();
  const detailQ = useEdgeDetail(mode === 'edit' ? id || null : null);
  const orgQ = useOrganizations();
  const [values, setValues] = useState<EdgeForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [syncReveal, setSyncReveal] = useState<{
    edgeId: string;
    serverUrl: string;
    creds: RendererSyncCredentials;
  } | null>(null);
  const [credentialCopied, setCredentialCopied] = useState<string | null>(null);
  const [licenseOpen, setLicenseOpen] = useState(false);
  const sitesQ = useSites(values.organization_id);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (mode !== 'create') return;
    const oid = searchParams.get('organizationId');
    const sid = searchParams.get('siteId');
    if (!oid && !sid) return;
    setValues((prev) => {
      const next = { ...prev };
      if (oid && !prev.organization_id) next.organization_id = oid;
      if (sid && !prev.site_id) next.site_id = sid;
      return next;
    });
  }, [mode, searchParams]);

  useEffect(() => {
    if (mode !== 'create') return;
    const rows = orgQ.data;
    if (!rows?.length || values.organization_id) return;
    if (rows.length !== 1) return;
    const id = organizationOptionId(rows[0]);
    if (id) setValues((v) => ({ ...v, organization_id: id, site_id: '' }));
  }, [mode, orgQ.data, values.organization_id]);

  useEffect(() => {
    if (!detailQ.data) return;
    const d = detailQ.data;
    setValues({
      organization_id: d.organization_id,
      site_id: d.site_id,
      edge_server_name: d.edge_server_name,
      edge_server_code: d.edge_server_code,
      server_type: d.server_type,
      server_status: d.server_status,
      assigned_license_id: d.assigned_license_id || '',
      max_camera_capacity: String(d.max_camera_capacity || ''),
      machine_id: d.machine_id || '',
      hostname: d.hostname || '',
      local_ip_address: d.local_ip_address || '',
      mac_address: d.mac_address || '',
      public_ip_address: d.public_ip_address || '',
      os_type: d.os_type || '',
      os_version: d.os_version || '',
      cpu_details: d.cpu_details || '',
      ram_gb: d.ram_gb?.toString() || '',
      gpu_details: d.gpu_details || '',
      storage_capacity_gb: d.storage_capacity_gb?.toString() || '',
      renderer_software_version: d.renderer_software_version || '',
      last_heartbeat_time: d.last_heartbeat_time || '',
      last_sync_time: d.last_sync_time || '',
      remarks: d.remarks || '',
      sync_api_key_validity_months: '0',
    });
  }, [detailQ.data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: EdgeForm) => {
      if (!config) throw new Error('Not configured');
      if (mode === 'create') return apiPost(config, '/v1/admin/edge-servers', formToPayload(payload));
      return apiPut(config, `/v1/admin/edge-servers/${id}`, formToPayload(payload));
    },
    onSuccess: async (raw) => {
      await qc.invalidateQueries({ queryKey: ['edge-list'] });
      await qc.invalidateQueries({ queryKey: ['site-view-edges'] });
      const nextId = (raw as { edgeServer?: { id: string } })?.edgeServer?.id || id;
      const creds = (raw as { rendererSync?: RendererSyncCredentials }).rendererSync;
      const serverUrl = (config?.serverUrl?.trim() || '').replace(/\/+$/, '');
      if (mode === 'create' && creds?.api_key && nextId) {
        setSyncReveal({ edgeId: nextId, serverUrl, creds });
        return;
      }
      router.push(`${base}/edge-servers/${nextId}`);
    },
  });

  if (!user?.role || !['superadmin', 'org_admin', 'site_admin'].includes(user.role)) return <AccessDenied />;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors = validateForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    saveMutation.mutate(values);
  }

  function copyCredentialField(key: string, text: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCredentialCopied(key);
      window.setTimeout(() => {
        setCredentialCopied((k) => (k === key ? null : k));
      }, 2000);
    });
  }

  return (
    <div className="space-y-5">
      {syncReveal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sync-creds-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 p-5 shadow-xl">
            <h2 id="sync-creds-title" className="text-lg font-semibold text-slate-100">
              Renderer sync credentials
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Configure the edge renderer with these values. The API key is shown only once; store it securely.
            </p>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Server URL</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2 break-all font-mono text-slate-200">
                  {syncReveal.serverUrl || (
                    <span className="text-amber-400/90">Not set on this login — use your API base URL.</span>
                  )}
                  {syncReveal.serverUrl ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => copyCredentialField('url', syncReveal.serverUrl)}>
                      {credentialCopied === 'url' ? 'Copied' : 'Copy'}
                    </Button>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Site ID (X-Site-Id)</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2 break-all font-mono text-slate-200">
                  {syncReveal.creds.site_id}
                  <Button type="button" size="sm" variant="outline" onClick={() => copyCredentialField('site', syncReveal.creds.site_id)}>
                    {credentialCopied === 'site' ? 'Copied' : 'Copy'}
                  </Button>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">API key (X-API-Key)</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2 break-all font-mono text-xs text-slate-200">
                  {syncReveal.creds.api_key}
                  <Button type="button" size="sm" variant="outline" onClick={() => copyCredentialField('key', syncReveal.creds.api_key)}>
                    {credentialCopied === 'key' ? 'Copied' : 'Copy'}
                  </Button>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Device ID (heartbeat)</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2 break-all font-mono text-slate-200">
                  {syncReveal.creds.device_id}
                  <Button type="button" size="sm" variant="outline" onClick={() => copyCredentialField('device', syncReveal.creds.device_id)}>
                    {credentialCopied === 'device' ? 'Copied' : 'Copy'}
                  </Button>
                </dd>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Key issued</dt>
                  <dd className="mt-1 text-slate-300">{syncReveal.creds.api_key_issued_at || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Key expires</dt>
                  <dd className="mt-1 text-slate-300">{syncReveal.creds.api_key_expires_at || 'No expiry'}</dd>
                </div>
              </div>
            </dl>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const lines = [
                    `server_url=${syncReveal.serverUrl || ''}`,
                    `site_id=${syncReveal.creds.site_id}`,
                    `api_key=${syncReveal.creds.api_key}`,
                    `device_id=${syncReveal.creds.device_id}`,
                  ].join('\n');
                  copyCredentialField('all', lines);
                }}
              >
                {credentialCopied === 'all' ? 'Copied bundle' : 'Copy all as env-style'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSyncReveal(null);
                  router.push(`${base}/edge-servers/${syncReveal.edgeId}/edit`);
                }}
              >
                Issue license
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setSyncReveal(null);
                  router.push(`${base}/edge-servers/${syncReveal.edgeId}`);
                }}
              >
                Continue to edge server
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">{mode === 'create' ? 'Add Edge Server' : 'Edit Edge Server'}</h1>
        <Button variant="outline" onClick={() => router.push(`${base}/edge-servers`)}>Back</Button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Card className="border-slate-800"><CardHeader><CardTitle className="text-base text-slate-100">Basic Mapping</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-200">Organization<select className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2" value={values.organization_id} onChange={(e)=>setValues(v=>({...v, organization_id:e.target.value, site_id:''}))}><option value="">Select Organization</option>{(orgQ.data || []).map((o) => (
            <option key={organizationOptionId(o)} value={organizationOptionId(o)}>
              {organizationOptionLabel(o)}
            </option>
          ))}</select>{errors.organization_id ? <p className="text-xs text-rose-400">{errors.organization_id}</p> : null}</label>
          <label className="text-sm text-slate-200">Site / Location<select className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2" value={values.site_id} onChange={(e)=>setValues(v=>({...v, site_id:e.target.value}))}><option value="">Select Site</option>{(sitesQ.data || []).map((s) => (
            <option key={String(s.id)} value={String(s.id)}>
              {siteOptionLabel(s)}
            </option>
          ))}</select>{errors.site_id ? <p className="text-xs text-rose-400">{errors.site_id}</p> : null}</label>
          <label className="text-sm text-slate-200">Edge Server Name<input className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2" value={values.edge_server_name} onChange={(e)=>setValues(v=>({...v, edge_server_name:e.target.value}))} /></label>
          <label className="text-sm text-slate-200">Edge Server Code<input className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2" value={values.edge_server_code} onChange={(e)=>setValues(v=>({...v, edge_server_code:e.target.value}))} placeholder="Auto-generated when empty" /></label>
          <label className="text-sm text-slate-200">Server Type<select className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2" value={values.server_type} onChange={(e)=>setValues(v=>({...v, server_type:e.target.value}))}><option value="">Select type</option>{EDGE_SERVER_TYPES.map((x)=><option key={x} value={x}>{x}</option>)}</select></label>
          <label className="text-sm text-slate-200">Server Status<select className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2" value={values.server_status} onChange={(e)=>setValues(v=>({...v, server_status:e.target.value as EdgeServerStatus}))}>{EDGE_SERVER_STATUSES.map((x)=><option key={x} value={x}>{x}</option>)}</select></label>
        </CardContent></Card>

        <Card className="border-slate-800"><CardHeader><CardTitle className="text-base text-slate-100">License</CardTitle></CardHeader><CardContent className="space-y-3">
          <p className="text-xs text-slate-500">
            Save as <strong className="text-slate-300">Draft</strong> to register hardware without a key. Use{' '}
            <strong className="text-slate-300">Issue license</strong> to generate a key, then set status to Active.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-200">
              Assigned license key
              <input
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 p-2 text-slate-300"
                value={values.assigned_license_id}
                readOnly
                placeholder="Not issued yet"
              />
            </label>
            <label className="text-sm text-slate-200">
              Max camera capacity
              <input
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 p-2 text-slate-400"
                value={values.max_camera_capacity}
                disabled
                placeholder="Set when license is issued"
              />
            </label>
          </div>
          {mode === 'edit' && id ? (
            <Button type="button" variant="outline" className="text-slate-200" onClick={() => setLicenseOpen(true)}>
              {values.assigned_license_id ? 'Rotate license' : 'Issue license'}
            </Button>
          ) : (
            <p className="text-xs text-slate-500">Issue license after saving this edge server.</p>
          )}
        </CardContent></Card>

        {mode === 'edit' && id ? (
          <EdgeServerLicenseDialog
            edgeServerId={id}
            edgeServerName={values.edge_server_name || 'Edge server'}
            hasLicense={!!values.assigned_license_id?.trim()}
            defaultCameraLimit={Number(values.max_camera_capacity) || 50}
            open={licenseOpen}
            onClose={() => setLicenseOpen(false)}
            onApplied={(key) => {
              setValues((v) => ({ ...v, assigned_license_id: key }));
              void qc.invalidateQueries({ queryKey: ['edge-detail', id] });
            }}
          />
        ) : null}

        <Card className="border-slate-800"><CardHeader><CardTitle className="text-base text-slate-100">Renderer Sync Information</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
          {mode === 'create' ? (
            <label className="text-sm text-slate-200 sm:col-span-2">
              Sync API key validity
              <select
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2"
                value={values.sync_api_key_validity_months}
                onChange={(e) => setValues((v) => ({ ...v, sync_api_key_validity_months: e.target.value }))}
              >
                {SYNC_KEY_VALIDITY.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                After you save, a renderer sync API key is created for this edge server (same as IAM edge-device keys).
                Copy it once; it will not be shown again.
              </p>
            </label>
          ) : null}
          <label className="text-sm text-slate-200">Device / Machine ID<input className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 p-2 text-slate-400" value={values.machine_id} disabled /></label>
          <label className="text-sm text-slate-200">Hostname<input className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2" value={values.hostname} onChange={(e)=>setValues(v=>({...v, hostname:e.target.value}))} /></label>
          <label className="text-sm text-slate-200">Renderer Software Version<input className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 p-2 text-slate-400" value={values.renderer_software_version} disabled /></label>
          <label className="text-sm text-slate-200">Last Heartbeat Time (IST)<input className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 p-2 text-slate-400" value={formatUtcAsIst(values.last_heartbeat_time, '')} disabled /></label>
          <label className="text-sm text-slate-200">Last Sync Time<input className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 p-2 text-slate-400" value={values.last_sync_time} disabled /></label>
        </CardContent></Card>

        <Card className="border-slate-800"><CardHeader><CardTitle className="text-base text-slate-100">Hardware / System Information</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-200">Local IP Address<input className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2" value={values.local_ip_address} onChange={(e)=>setValues(v=>({...v, local_ip_address:e.target.value}))} /></label>
          <label className="text-sm text-slate-200">MAC Address<input className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2" value={values.mac_address} onChange={(e)=>setValues(v=>({...v, mac_address:e.target.value}))} /></label>
          <label className="text-sm text-slate-200">Public IP Address<input className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2" value={values.public_ip_address} onChange={(e)=>setValues(v=>({...v, public_ip_address:e.target.value}))} /></label>
          <label className="text-sm text-slate-200">OS Type<input className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2" value={values.os_type} onChange={(e)=>setValues(v=>({...v, os_type:e.target.value}))} /></label>
          <label className="text-sm text-slate-200">OS Version<input className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2" value={values.os_version} onChange={(e)=>setValues(v=>({...v, os_version:e.target.value}))} /></label>
          <label className="text-sm text-slate-200">CPU Details<input className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2" value={values.cpu_details} onChange={(e)=>setValues(v=>({...v, cpu_details:e.target.value}))} /></label>
          <label className="text-sm text-slate-200">RAM GB<input type="number" min={0} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2" value={values.ram_gb} onChange={(e)=>setValues(v=>({...v, ram_gb:e.target.value}))} /></label>
          <label className="text-sm text-slate-200">GPU Details<input className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2" value={values.gpu_details} onChange={(e)=>setValues(v=>({...v, gpu_details:e.target.value}))} /></label>
          <label className="text-sm text-slate-200">Storage Capacity GB<input type="number" min={0} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2" value={values.storage_capacity_gb} onChange={(e)=>setValues(v=>({...v, storage_capacity_gb:e.target.value}))} /></label>
          <label className="text-sm text-slate-200 sm:col-span-2">Remarks<textarea className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2" rows={3} value={values.remarks} onChange={(e)=>setValues(v=>({...v, remarks:e.target.value}))} /></label>
        </CardContent></Card>

        {Object.keys(errors).length ? <Card className="border-rose-700 bg-rose-900/20"><CardContent className="p-3 text-sm text-rose-200">{Object.values(errors)[0]}</CardContent></Card> : null}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : 'Save Edge Server'}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}

export function EdgeServersListPage() {
  const base = useAdminBasePath();
  const { config, user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const list = useEdgeList();
  const orgQ = useOrganizations();
  const sitesQ = useSites(list.organizationId);

  const del = useMutation({
    mutationFn: async (id: string) => {
      if (!config) throw new Error('Not configured');
      return apiDelete(config, `/v1/admin/edge-servers/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['edge-list'] }),
  });

  const sync = useMutation({
    mutationFn: async (id: string) => {
      if (!config) throw new Error('Not configured');
      return apiPost(config, `/v1/admin/edge-servers/${id}/sync`, {});
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['edge-list'] }),
  });

  const test = useMutation({
    mutationFn: async (id: string) => {
      if (!config) throw new Error('Not configured');
      return apiPost(config, `/v1/admin/edge-servers/${id}/test-connection`, {});
    },
  });

  if (!user?.role || !['superadmin', 'org_admin', 'site_admin', 'operator', 'site_viewer'].includes(user.role)) return <AccessDenied />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">Edge Server / Renderer Management</h1>
        <Button onClick={() => router.push(`${base}/edge-servers/new`)}>Add Edge Server</Button>
      </div>

      <Card className="border-slate-800"><CardHeader className="py-3"><CardTitle className="text-base text-slate-100">Filters</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <input className="rounded-md border border-slate-700 bg-slate-900 p-2 text-sm" placeholder="Search name/code" value={list.search} onChange={(e)=>list.setSearch(e.target.value)} />
        <select className="rounded-md border border-slate-700 bg-slate-900 p-2 text-sm" value={list.organizationId} onChange={(e)=>{list.setOrganizationId(e.target.value); list.setSiteId('');}}><option value="">Organization</option>{(orgQ.data || []).map((o) => (
          <option key={organizationOptionId(o)} value={organizationOptionId(o)}>
            {organizationOptionLabel(o)}
          </option>
        ))}</select>
        <select className="rounded-md border border-slate-700 bg-slate-900 p-2 text-sm" value={list.siteId} onChange={(e)=>list.setSiteId(e.target.value)}><option value="">Site</option>{(sitesQ.data || []).map((s) => (
          <option key={String(s.id)} value={String(s.id)}>
            {siteOptionLabel(s)}
          </option>
        ))}</select>
        <select className="rounded-md border border-slate-700 bg-slate-900 p-2 text-sm" value={list.serverType} onChange={(e)=>list.setServerType(e.target.value)}><option value="">Server Type</option>{EDGE_SERVER_TYPES.map((x)=><option key={x} value={x}>{x}</option>)}</select>
        <select className="rounded-md border border-slate-700 bg-slate-900 p-2 text-sm" value={list.serverStatus} onChange={(e)=>list.setServerStatus(e.target.value)}><option value="">Server Status</option>{EDGE_SERVER_STATUSES.map((x)=><option key={x} value={x}>{x}</option>)}</select>
      </CardContent></Card>

      <Card className="border-slate-800"><CardContent className="p-0 overflow-x-auto">
        {list.isLoading ? <div className="p-4 text-sm text-slate-400">Loading edge servers...</div> : null}
        {!list.isLoading && list.data?.data?.length === 0 ? <div className="p-4 text-sm text-slate-400">No edge servers found.</div> : null}
        {list.data?.data?.length ? (
          <table className="w-full text-sm"><thead className="bg-slate-900/80 text-slate-300"><tr>
            <th className="px-3 py-2 text-left">Edge Server Code</th><th className="px-3 py-2 text-left">Edge Server Name</th><th className="px-3 py-2 text-left">Organization</th><th className="px-3 py-2 text-left">Site</th><th className="px-3 py-2 text-left">Server Type</th><th className="px-3 py-2 text-left">License</th><th className="px-3 py-2 text-left">Max Camera Capacity</th><th className="px-3 py-2 text-left">Server Status</th><th className="px-3 py-2 text-left">Last Heartbeat (IST)</th><th className="px-3 py-2 text-left">Renderer Version</th><th className="px-3 py-2 text-left">Actions</th>
          </tr></thead><tbody>
            {list.data.data.map((row: EdgeServerRecord)=><tr key={row.id} className="border-t border-slate-800">
              <td className="px-3 py-2 text-slate-100">{row.edge_server_code}</td>
              <td className="px-3 py-2 text-slate-200">{row.edge_server_name}</td>
              <td className="px-3 py-2 text-slate-400">{row.organization_name || '-'}</td>
              <td className="px-3 py-2 text-slate-400">{row.site_name || '-'}</td>
              <td className="px-3 py-2 text-slate-400">{row.server_type}</td>
              <td className="px-3 py-2 text-slate-400">{row.assigned_license_id || '-'}</td>
              <td className="px-3 py-2 text-slate-400">{row.max_camera_capacity}</td>
              <td className="px-3 py-2"><EdgeServerStatusBadge status={row.server_status} /></td>
              <td className="px-3 py-2 text-slate-400">{formatUtcAsIst(row.last_heartbeat_time)}</td>
              <td className="px-3 py-2 text-slate-400">{row.renderer_software_version || '-'}</td>
              <td className="px-3 py-2"><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>router.push(`${base}/edge-servers/${row.id}`)}>View</Button><Button size="sm" variant="outline" onClick={()=>router.push(`${base}/edge-servers/${row.id}/edit`)}>Edit</Button><Button size="sm" variant="outline" onClick={()=>sync.mutate(row.id)}>Sync</Button><Button size="sm" variant="outline" onClick={()=>test.mutate(row.id)}>Test</Button><Button size="sm" variant="destructive" onClick={()=>del.mutate(row.id)}>Deactivate</Button></div></td>
            </tr>)}
          </tbody></table>
        ) : null}
      </CardContent></Card>

      {(test.data as any)?.result ? <Card className="border-slate-800"><CardContent className="p-3 text-sm text-slate-300">Test Connection: {(test.data as any).result.message} (Last heartbeat IST: {formatUtcAsIst((test.data as any).result.lastHeartbeatTime, 'N/A')})</CardContent></Card> : null}
    </div>
  );
}

export function EdgeServerCreatePage() {
  return <EdgeServerForm mode="create" />;
}

export function EdgeServerEditPage() {
  return <EdgeServerForm mode="edit" />;
}

export function EdgeServerViewPage() {
  const base = useAdminBasePath();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const detailQ = useEdgeDetail(id || null);
  const healthQ = useEdgeHealth(id || null);
  const [licenseOpen, setLicenseOpen] = useState(false);

  if (detailQ.isLoading) return <div className="text-sm text-slate-400">Loading...</div>;
  if (!detailQ.data) return <div className="text-sm text-rose-400">Edge server not found.</div>;

  const d = detailQ.data;
  const online = d.online_status === 'online';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">{d.edge_server_name}</h1>
          <p className="text-sm text-slate-400">{d.edge_server_code} • {d.organization_name} • {d.site_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <EdgeServerStatusBadge status={d.server_status} />
          <Button variant="outline" onClick={() => setLicenseOpen(true)}>
            {d.assigned_license_id ? 'Rotate license' : 'Issue license'}
          </Button>
          <Button variant="outline" onClick={() => router.push(`${base}/edge-servers/${d.id}/edit`)}>Edit</Button>
        </div>
      </div>

      <EdgeServerLicenseDialog
        edgeServerId={d.id}
        edgeServerName={d.edge_server_name}
        hasLicense={!!d.assigned_license_id}
        defaultCameraLimit={d.max_camera_capacity || 50}
        open={licenseOpen}
        onClose={() => setLicenseOpen(false)}
        onApplied={() => void detailQ.refetch()}
      />

      <Card className="border-slate-800"><CardHeader className="py-3"><CardTitle className="text-base text-slate-100">Tabs</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-2">{['Overview','Renderer Info','Cameras','License','Health Logs','Sync Logs','Audit Logs'].map((t)=><span key={t} className={`rounded-md px-3 py-1 text-sm ${t==='Overview'||t==='Renderer Info' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{t}</span>)}</div></CardContent></Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-800"><CardContent className="p-4"><p className="text-xs text-slate-500">Server Status</p><p className="text-sm text-slate-100">{d.server_status}</p></CardContent></Card>
        <Card className="border-slate-800"><CardContent className="p-4"><p className="text-xs text-slate-500">Max Camera Capacity</p><p className="text-sm text-slate-100">{d.max_camera_capacity}</p></CardContent></Card>
        <Card className="border-slate-800"><CardContent className="p-4"><p className="text-xs text-slate-500">Assigned Cameras</p><p className="text-sm text-slate-100">0</p></CardContent></Card>
        <Card className="border-slate-800"><CardContent className="p-4"><p className="text-xs text-slate-500">Online Cameras</p><p className="text-sm text-slate-100">0</p></CardContent></Card>
        <Card className="border-slate-800"><CardContent className="p-4"><p className="text-xs text-slate-500">Last Heartbeat (IST)</p><p className="text-sm text-slate-100">{formatUtcAsIst(d.last_heartbeat_time)}</p></CardContent></Card>
        <Card className="border-slate-800"><CardContent className="p-4"><p className="text-xs text-slate-500">Renderer Version</p><p className="text-sm text-slate-100">{d.renderer_software_version || '-'}</p></CardContent></Card>
        <Card className="border-slate-800"><CardContent className="p-4"><p className="text-xs text-slate-500">CPU / RAM / GPU Summary</p><p className="text-sm text-slate-100">{d.cpu_details || '-'} / {d.ram_gb ?? '-'} / {d.gpu_details || '-'}</p></CardContent></Card>
        <Card className="border-slate-800"><CardContent className="p-4"><p className="text-xs text-slate-500">Storage Capacity</p><p className="text-sm text-slate-100">{d.storage_capacity_gb ?? '-'} GB</p></CardContent></Card>
      </div>

      <Card className="border-slate-800"><CardHeader className="py-3"><CardTitle className="text-base text-slate-100">Overview</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
        {field('Organization', d.organization_name)}
        {field('Site / Location', d.site_name)}
        {field('Edge Server Name', d.edge_server_name)}
        {field('Edge Server Code', d.edge_server_code)}
        {field('Server Type', d.server_type)}
        {field('Server Status', d.server_status)}
        <div className="min-w-0 sm:col-span-2 lg:col-span-3">
          {field('Assigned License', d.assigned_license_id, { mono: true })}
        </div>
        {field('Max Camera Capacity', String(d.max_camera_capacity))}
        {field('Last Heartbeat Time (IST)', formatUtcAsIst(d.last_heartbeat_time))}
        {field('Last Sync Time (IST)', formatUtcAsIst(d.last_sync_time))}
        {field('Renderer Software Version', d.renderer_software_version)}
        {field('Remarks', d.remarks)}
      </CardContent></Card>

      <Card className="border-slate-800"><CardHeader className="py-3"><CardTitle className="text-base text-slate-100">Renderer Info</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {field('Device / Machine ID', d.machine_id)}
        {field('Hostname', d.hostname)}
        {field('Local IP Address', d.local_ip_address)}
        {field('MAC Address', d.mac_address)}
        {field('Public IP Address', d.public_ip_address)}
        {field('OS Type', d.os_type)}
        {field('OS Version', d.os_version)}
        {field('CPU Details', d.cpu_details)}
        {field('RAM GB', d.ram_gb?.toString())}
        {field('GPU Details', d.gpu_details)}
        {field('Storage Capacity GB', d.storage_capacity_gb?.toString())}
        {field('Online / Offline', online ? 'online' : 'offline')}
      </CardContent></Card>

      <Card className="border-slate-800"><CardHeader className="py-3"><CardTitle className="text-base text-slate-100">Health Logs</CardTitle></CardHeader><CardContent className="space-y-2">
        {healthQ.isLoading ? <p className="text-sm text-slate-400">Loading health logs...</p> : null}
        {!healthQ.isLoading && !healthQ.data?.length ? <p className="text-sm text-slate-500">No heartbeat logs yet.</p> : null}
        {healthQ.data?.slice(0, 5).map((h) => (
          <div key={h.id} className="rounded-md border border-slate-800 p-3 text-sm text-slate-300">{formatUtcAsIst(h.heartbeat_time)} • CPU {h.cpu_usage_percent ?? '-'}% • RAM {h.ram_usage_percent ?? '-'}% • Status {h.renderer_status || '-'}</div>
        ))}
      </CardContent></Card>
    </div>
  );
}
