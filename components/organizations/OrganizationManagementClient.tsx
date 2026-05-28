'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AccessDenied } from '@/components/auth/role-gate';
import { useAuth } from '@/app/providers/auth-provider';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api-client';
import {
  type Organization,
  type OrganizationListResponse,
  type OrganizationStatus,
  ORGANIZATION_STATUSES,
} from './types';
import {
  OrganizationForm,
  emptyOrganizationForm,
  mapOrganizationToForm,
  type OrganizationFormValues,
} from './OrganizationForm';
import { OrganizationStatusBadge } from './OrganizationStatusBadge';
import { parseOrganizationItemResponse, parseOrganizationListResponse } from './contracts';
import { useAdminBasePath } from '@/components/admin-navigation-context';
import { parseSitesList } from '@/components/sites/contracts';
import { SiteStatusBadge } from '@/components/sites/SiteStatusBadge';
import type { SiteRecord } from '@/components/sites/types';
import { parseUser } from '@/components/user-role-permission/contracts';
import { UserStatusBadge } from '@/components/user-role-permission/UserStatusBadge';
import { OrganizationLicenseEditor, OrganizationLicenseSummary } from './OrganizationLicensePanel';

const MOBILE_RE = /^[6-9][0-9]{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

function validate(values: OrganizationFormValues): Record<string, string> {
  const e: Record<string, string> = {};
  const required = [
    'organization_name',
    'industry_type',
    'registered_address',
    'city',
    'state',
    'country',
    'pincode',
    'primary_contact_name',
    'primary_contact_mobile',
    'primary_contact_email',
    'organization_status',
  ] as const;
  required.forEach((f) => {
    if (!String(values[f] || '').trim()) e[f] = 'Required';
  });

  if (values.organization_name.trim().length < 2 || values.organization_name.trim().length > 200) {
    e.organization_name = 'Must be 2-200 characters';
  }
  if (values.website) {
    try {
      new URL(values.website);
    } catch {
      e.website = 'Invalid URL';
    }
  }
  const mobileHint = 'Use 10 digits starting with 6-9 (e.g. 9876543210).';
  if (values.primary_contact_mobile && !MOBILE_RE.test(values.primary_contact_mobile)) {
    e.primary_contact_mobile = `Invalid mobile. ${mobileHint}`;
  }
  if (values.billing_contact_mobile && !MOBILE_RE.test(values.billing_contact_mobile)) {
    e.billing_contact_mobile = `Invalid mobile. ${mobileHint}`;
  }
  if (values.primary_contact_email && !EMAIL_RE.test(values.primary_contact_email)) e.primary_contact_email = 'Invalid email';
  if (values.billing_contact_email && !EMAIL_RE.test(values.billing_contact_email)) e.billing_contact_email = 'Invalid email';
  if (values.pan_number && !PAN_RE.test(values.pan_number)) e.pan_number = 'Invalid PAN';
  if (values.gst_number && !GST_RE.test(values.gst_number)) e.gst_number = 'Invalid GST';
  return e;
}

function normalizePayload(values: OrganizationFormValues) {
  return {
    ...values,
    organization_name: values.organization_name.trim(),
    organization_code: values.organization_code.trim() || undefined,
    industry_type: values.industry_type.trim(),
    city: values.city.trim(),
    state: values.state.trim(),
    country: values.country.trim() || 'India',
    pincode: values.pincode.trim(),
    primary_contact_name: values.primary_contact_name.trim(),
    primary_contact_mobile: values.primary_contact_mobile.trim(),
    primary_contact_email: values.primary_contact_email.trim().toLowerCase(),
    business_type: values.business_type || null,
    website: values.website || null,
    gst_number: values.gst_number || null,
    pan_number: values.pan_number || null,
    billing_contact_name: values.billing_contact_name || null,
    billing_contact_mobile: values.billing_contact_mobile || null,
    billing_contact_email: values.billing_contact_email ? values.billing_contact_email.toLowerCase() : null,
    remarks: values.remarks || null,
  };
}

function useOrganizationsQuery() {
  const { config } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [industryType, setIndustryType] = useState('');

  const query = useQuery<OrganizationListResponse>({
    queryKey: ['organizations', search, status, industryType, config?.token],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (industryType) params.set('industryType', industryType);
      params.set('page', '1');
      params.set('pageSize', '50');
      const raw = await apiGet(config, `/v1/admin/organizations?${params.toString()}`);
      return parseOrganizationListResponse(raw);
    },
    enabled: !!config,
  });

  return { ...query, search, setSearch, status, setStatus, industryType, setIndustryType };
}

export function OrganizationListPage() {
  const base = useAdminBasePath();
  const { hasRole, config } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const q = useOrganizationsQuery();

  if (!hasRole('superadmin', 'org_admin')) {
    return <AccessDenied message="Only platform or organization admins can manage organizations." />;
  }

  const statusMutation = useMutation({
    mutationFn: async (args: { id: string; status: OrganizationStatus }) => {
      if (!config) throw new Error('Not configured');
      return apiPost(config, `/v1/admin/organizations/${args.id}/status`, { status: args.status });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!config) throw new Error('Not configured');
      return apiDelete(config, `/v1/admin/organizations/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  });

  const organizations = q.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Organization Management</h1>
          <p className="text-slate-400">Create, edit, view, and control organization status.</p>
        </div>
        <Link href={`${base}/organizations/new`}>
          <Button>Add Organization</Button>
        </Link>
      </div>

      <Card className="border-slate-800">
        <CardHeader className="py-3">
          <CardTitle className="text-base text-slate-100">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <input className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" placeholder="Search name or code" value={q.search} onChange={(e) => q.setSearch(e.target.value)} />
          <select className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" value={q.status} onChange={(e) => q.setStatus(e.target.value)}>
            <option value="">All status</option>
            {ORGANIZATION_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
          <input className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100" placeholder="Industry type" value={q.industryType} onChange={(e) => q.setIndustryType(e.target.value)} />
        </CardContent>
      </Card>

      <Card className="border-slate-800">
        <CardHeader className="py-3">
          <CardTitle className="text-base text-slate-100">Organizations ({organizations.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {q.isLoading ? <p className="text-slate-400">Loading...</p> : null}
          {q.error ? <p className="text-red-400">{q.error instanceof Error ? q.error.message : 'Failed to load organizations'}</p> : null}
          {!q.isLoading && !q.error && (
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="pb-3 pr-4">Organization Code</th>
                  <th className="pb-3 pr-4">Organization Name</th>
                  <th className="pb-3 pr-4">Industry Type</th>
                  <th className="pb-3 pr-4">Business Type</th>
                  <th className="pb-3 pr-4">Primary Contact</th>
                  <th className="pb-3 pr-4">City / State</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Created Date</th>
                  <th className="pb-3 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((o) => (
                  <tr key={o.id} className="border-b border-slate-800/40">
                    <td className="py-3 pr-4 text-slate-300">{o.organization_code}</td>
                    <td className="py-3 pr-4 text-slate-100">{o.organization_name}</td>
                    <td className="py-3 pr-4 text-slate-400">{o.industry_type}</td>
                    <td className="py-3 pr-4 text-slate-400">{o.business_type ?? '-'}</td>
                    <td className="py-3 pr-4 text-slate-400">{o.primary_contact_name} ({o.primary_contact_mobile})</td>
                    <td className="py-3 pr-4 text-slate-400">{o.city} / {o.state}</td>
                    <td className="py-3 pr-4"><OrganizationStatusBadge status={o.organization_status} /></td>
                    <td className="py-3 pr-4 text-slate-400">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => router.push(`${base}/organizations/${o.id}`)}>View</Button>
                        <Button size="sm" variant="outline" onClick={() => router.push(`${base}/organizations/${o.id}/edit`)}>Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: o.id, status: 'Active' })}>Activate</Button>
                        <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: o.id, status: 'Suspended' })}>Suspend</Button>
                        <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: o.id, status: 'Inactive' })}>Mark Inactive</Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(o.id)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function OrganizationCreatePage() {
  const base = useAdminBasePath();
  const { hasRole, config } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const [values, setValues] = useState<OrganizationFormValues>(emptyOrganizationForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!hasRole('superadmin', 'org_admin')) return <AccessDenied message="Only admins can create organizations." />;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!config) throw new Error('Not configured');
      return apiPost(config, '/v1/admin/organizations', normalizePayload(values));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations'] });
      router.push(`${base}/organizations`);
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-100">Add Organization</h1>
      {mutation.error ? <p className="text-sm text-red-400">{mutation.error instanceof Error ? mutation.error.message : 'Failed to create'}</p> : null}
      <OrganizationForm
        values={values}
        errors={errors}
        onChange={(name, value) => setValues((prev) => ({ ...prev, [name]: value }))}
        onSubmit={(e) => {
          e.preventDefault();
          const v = validate(values);
          setErrors(v);
          if (Object.keys(v).length === 0) mutation.mutate();
        }}
        submitLabel="Create Organization"
        saving={mutation.isPending}
      />
    </div>
  );
}

function useOrganizationById(id: string | null) {
  const { config } = useAuth();
  return useQuery<{ ok: boolean; organization: Organization }>({
    queryKey: ['organization', id, config?.token],
    queryFn: async () => {
      if (!config || !id) throw new Error('Missing organization id');
      const raw = await apiGet(config, `/v1/admin/organizations/${id}`);
      return parseOrganizationItemResponse(raw);
    },
    enabled: !!config && !!id,
  });
}

const ORG_DETAIL_TABS = ['Overview', 'Sites', 'Users', 'Licenses', 'Reports', 'Audit Logs'] as const;
type OrgDetailTab = (typeof ORG_DETAIL_TABS)[number];

function useOrganizationSitesForView(organizationId: string | undefined) {
  const { config } = useAuth();
  return useQuery({
    queryKey: ['org-detail-sites', organizationId, config?.token],
    queryFn: async () => {
      if (!config || !organizationId) throw new Error('Not configured');
      const p = new URLSearchParams({ page: '1', pageSize: '100', organizationId });
      const raw = await apiGet(config, `/v1/admin/sites?${p.toString()}`);
      return parseSitesList(raw);
    },
    enabled: !!config && !!organizationId,
  });
}

function useOrganizationUsersForView(organizationId: string | undefined) {
  const { config } = useAuth();
  return useQuery({
    queryKey: ['org-detail-users', organizationId, config?.token],
    queryFn: async () => {
      if (!config || !organizationId) throw new Error('Not configured');
      const p = new URLSearchParams({ page: '1', limit: '100', organizationId });
      const raw = await apiGet(config, `/v1/admin/users?${p.toString()}`);
      const rows = Array.isArray((raw as { data?: unknown[] }).data) ? (raw as { data: unknown[] }).data : [];
      return rows.map(parseUser);
    },
    enabled: !!config && !!organizationId,
  });
}

export function OrganizationEditPage() {
  const base = useAdminBasePath();
  const { id } = useParams<{ id: string }>();
  const { hasRole, config } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const orgQuery = useOrganizationById(id || null);
  const [values, setValues] = useState<OrganizationFormValues>(emptyOrganizationForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!hasRole('superadmin', 'org_admin')) return <AccessDenied message="Only admins can edit organizations." />;

  const org = orgQuery.data?.organization;
  const current = useMemo(() => (org ? mapOrganizationToForm(org) : null), [org]);
  const effectiveValues = values.organization_name ? values : current ?? emptyOrganizationForm;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!config || !id) throw new Error('Missing configuration');
      return apiPut(config, `/v1/admin/organizations/${id}`, normalizePayload(effectiveValues));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations'] });
      qc.invalidateQueries({ queryKey: ['organization', id] });
      router.push(`${base}/organizations/${id}`);
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-100">Edit Organization</h1>
      {orgQuery.isLoading ? <p className="text-slate-400">Loading...</p> : null}
      {orgQuery.error ? <p className="text-red-400">{orgQuery.error instanceof Error ? orgQuery.error.message : 'Failed to load organization'}</p> : null}
      {org ? (
        <OrganizationForm
          values={effectiveValues}
          errors={errors}
          onChange={(name, value) => setValues((prev) => ({ ...prev, [name]: value }))}
          onSubmit={(e) => {
            e.preventDefault();
            const v = validate(effectiveValues);
            setErrors(v);
            if (Object.keys(v).length === 0) mutation.mutate();
          }}
          submitLabel="Save Changes"
          disableCodeEdit={!hasRole('superadmin')}
          saving={mutation.isPending}
        />
      ) : null}
      {org && id ? <OrganizationLicenseEditor organizationId={id} /> : null}
    </div>
  );
}

export function OrganizationViewPage() {
  const { id } = useParams<{ id: string }>();
  const { hasRole } = useAuth();
  const base = useAdminBasePath();
  const router = useRouter();
  const q = useOrganizationById(id || null);
  const [tab, setTab] = useState<OrgDetailTab>('Overview');
  const sitesQ = useOrganizationSitesForView(id);
  const usersQ = useOrganizationUsersForView(id);

  useEffect(() => {
    setTab('Overview');
  }, [id]);

  if (!hasRole('superadmin', 'org_admin', 'site_admin')) return <AccessDenied message="Not authorized to view organization." />;

  const org = q.data?.organization;

  return (
    <div className="space-y-6">
      {q.isLoading ? <p className="text-slate-400">Loading...</p> : null}
      {q.error ? <p className="text-red-400">{q.error instanceof Error ? q.error.message : 'Failed to load organization'}</p> : null}
      {org ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-100">{org.organization_name}</h1>
              <span className="text-slate-500">{org.organization_code}</span>
              <OrganizationStatusBadge status={org.organization_status} />
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push(`${base}/organizations/${org.id}/edit`)}>
              Edit organization
            </Button>
          </div>

          <Card className="border-slate-800">
            <CardHeader className="py-3">
              <CardTitle className="text-base text-slate-100">Tabs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Organization sections">
                {ORG_DETAIL_TABS.map((t) => (
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
            <Card className="border-slate-800">
              <CardHeader className="py-3">
                <CardTitle className="text-base text-slate-100">Overview</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <p className="text-slate-300">
                  <span className="text-slate-500">Industry:</span> {org.industry_type}
                </p>
                <p className="text-slate-300">
                  <span className="text-slate-500">Business Type:</span> {org.business_type ?? '-'}
                </p>
                <p className="text-slate-300 sm:col-span-2">
                  <span className="text-slate-500">Registered Address:</span> {org.registered_address}
                </p>
                <p className="text-slate-300">
                  <span className="text-slate-500">City / State:</span> {org.city} / {org.state}
                </p>
                <p className="text-slate-300">
                  <span className="text-slate-500">Country / Pincode:</span> {org.country} / {org.pincode}
                </p>
                <p className="text-slate-300">
                  <span className="text-slate-500">Primary Contact:</span> {org.primary_contact_name}
                </p>
                <p className="text-slate-300">
                  <span className="text-slate-500">Primary Mobile:</span> {org.primary_contact_mobile}
                </p>
                <p className="text-slate-300">
                  <span className="text-slate-500">Primary Email:</span> {org.primary_contact_email}
                </p>
                <p className="text-slate-300">
                  <span className="text-slate-500">Billing Contact:</span> {org.billing_contact_name ?? '-'}
                </p>
                <p className="text-slate-300">
                  <span className="text-slate-500">Billing Mobile:</span> {org.billing_contact_mobile ?? '-'}
                </p>
                <p className="text-slate-300">
                  <span className="text-slate-500">Billing Email:</span> {org.billing_contact_email ?? '-'}
                </p>
                <p className="text-slate-300">
                  <span className="text-slate-500">GST:</span> {org.gst_number ?? '-'}
                </p>
                <p className="text-slate-300">
                  <span className="text-slate-500">PAN:</span> {org.pan_number ?? '-'}
                </p>
                <p className="text-slate-300 sm:col-span-2">
                  <span className="text-slate-500">Remarks:</span> {org.remarks ?? '-'}
                </p>
                <p className="text-slate-300">
                  <span className="text-slate-500">Created At:</span> {new Date(org.created_at).toLocaleString()}
                </p>
                <p className="text-slate-300">
                  <span className="text-slate-500">Updated At:</span> {org.updated_at ? new Date(org.updated_at).toLocaleString() : '-'}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {tab === 'Overview' ? <OrganizationLicenseSummary organizationId={org.id} /> : null}

          {tab === 'Sites' ? (
            <Card className="border-slate-800">
              <CardHeader className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base text-slate-100">Sites in this organization</CardTitle>
                <Button asChild size="sm">
                  <Link href={`${base}/sites/new?organizationId=${encodeURIComponent(org.id)}`}>Add site</Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {sitesQ.isLoading ? <div className="p-4 text-sm text-slate-400">Loading sites...</div> : null}
                {sitesQ.error ? (
                  <div className="p-4 text-sm text-red-400">
                    {sitesQ.error instanceof Error ? sitesQ.error.message : 'Failed to load sites'}
                  </div>
                ) : null}
                {!sitesQ.isLoading && !sitesQ.error && !(sitesQ.data?.data?.length ?? 0) ? (
                  <div className="p-4 text-sm text-slate-400">No sites yet. Add a site to attach locations and edge servers.</div>
                ) : null}
                {(sitesQ.data?.data?.length ?? 0) > 0 ? (
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/80 text-left text-xs uppercase tracking-wider text-slate-500">
                        <th className="px-3 py-2">Code</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">City / State</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Created</th>
                        <th className="px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(sitesQ.data?.data ?? []).map((s: SiteRecord) => (
                        <tr key={s.id} className="border-b border-slate-800/60">
                          <td className="px-3 py-2 text-slate-300">{s.site_code}</td>
                          <td className="px-3 py-2 text-slate-100">{s.site_name}</td>
                          <td className="px-3 py-2 text-slate-400">{s.site_type}</td>
                          <td className="px-3 py-2 text-slate-400">
                            {s.city} / {s.state}
                          </td>
                          <td className="px-3 py-2">
                            <SiteStatusBadge status={s.site_status} />
                          </td>
                          <td className="px-3 py-2 text-slate-400">{new Date(s.created_at).toLocaleDateString()}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => router.push(`${base}/sites/${s.id}`)}>
                                View
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => router.push(`${base}/sites/${s.id}/edit`)}>
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
                <CardTitle className="text-base text-slate-100">Users in this organization</CardTitle>
                <Button asChild size="sm">
                  <Link href={`${base}/users/new?organizationId=${encodeURIComponent(org.id)}`}>Add user</Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {usersQ.isLoading ? <div className="p-4 text-sm text-slate-400">Loading users...</div> : null}
                {usersQ.error ? (
                  <div className="p-4 text-sm text-red-400">
                    {usersQ.error instanceof Error ? usersQ.error.message : 'Failed to load users'}
                  </div>
                ) : null}
                {!usersQ.isLoading && !usersQ.error && !(usersQ.data?.length ?? 0) ? (
                  <div className="p-4 text-sm text-slate-400">No users in this organization yet.</div>
                ) : null}
                {(usersQ.data?.length ?? 0) > 0 ? (
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/80 text-left text-xs uppercase tracking-wider text-slate-500">
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Mobile</th>
                        <th className="px-3 py-2">Role</th>
                        <th className="px-3 py-2">Sites</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(usersQ.data ?? []).map((u) => (
                        <tr key={u.id} className="border-b border-slate-800/60">
                          <td className="px-3 py-2 text-slate-100">{u.full_name}</td>
                          <td className="px-3 py-2 text-slate-300">{u.email}</td>
                          <td className="px-3 py-2 text-slate-300">{u.mobile}</td>
                          <td className="px-3 py-2 text-slate-400">{u.role_name ?? '-'}</td>
                          <td className="px-3 py-2 text-slate-400">{u.assigned_sites?.length ?? 0}</td>
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

          {tab === 'Licenses' || tab === 'Reports' || tab === 'Audit Logs' ? (
            <Card className="border-slate-800">
              <CardHeader className="py-3">
                <CardTitle className="text-base text-slate-100">{tab}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500">This section is not wired in the tenant admin UI yet.</p>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
