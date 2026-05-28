'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/app/providers/auth-provider';
import { apiGet, apiPut } from '@/lib/api-client';

type OrgLicense = {
  org_id: string;
  tier: string;
  cameras_quota: number;
  cameras_used: number;
  storage_quota_gb: number;
  storage_used_gb: number;
  billing_cycle: 'monthly' | 'annual';
  billing_start: string;
  billing_end: string;
  status: string;
};

type LicenseResponse = { ok: boolean; license: OrgLicense };

export function OrganizationLicenseSummary({ organizationId }: { organizationId: string }) {
  const { config, hasRole } = useAuth();
  const q = useQuery({
    queryKey: ['org-license', organizationId, config?.token],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      return apiGet<LicenseResponse>(config, `/v1/admin/organizations/${encodeURIComponent(organizationId)}/license`);
    },
    enabled:
      !!config &&
      !!organizationId &&
      (hasRole('superadmin') || hasRole('org_admin') || hasRole('site_admin')),
  });

  if (!hasRole('superadmin') && !hasRole('org_admin') && !hasRole('site_admin')) return null;
  if (q.isLoading) return <p className="text-sm text-slate-500">Loading license usage…</p>;
  if (q.isError) return <p className="text-sm text-rose-400">Could not load license for this organization.</p>;
  const lic = q.data?.license;
  if (!lic) return null;

  const camPct = lic.cameras_quota > 0 ? Math.min(100, (lic.cameras_used / lic.cameras_quota) * 100) : 0;

  return (
    <Card className="border-slate-800">
      <CardHeader className="py-3">
        <CardTitle className="text-base text-slate-100">License & usage</CardTitle>
        <p className="text-xs text-slate-500">
          Subscription entitlements for this organization. Camera enrollments are blocked when usage reaches the camera
          quota.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-slate-500">Plan / status</p>
          <p className="text-sm text-slate-200">
            {lic.tier} · {lic.status}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Billing</p>
          <p className="text-sm text-slate-200 capitalize">
            {lic.billing_cycle} · renews {new Date(lic.billing_end).toLocaleDateString()}
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-slate-500">Cameras</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-semibold text-slate-100">{lic.cameras_used}</span>
            <span className="text-slate-500">/ {lic.cameras_quota} licensed</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700">
            <div
              className={`h-full rounded-full ${camPct >= 90 ? 'bg-red-500' : camPct >= 70 ? 'bg-amber-500' : 'bg-blue-500'}`}
              style={{ width: `${camPct}%` }}
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-slate-500">Storage</p>
          <p className="text-sm text-slate-200">
            {lic.storage_used_gb} / {lic.storage_quota_gb} GB (reporting only; enforcement can be wired later)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function OrganizationLicenseEditor({ organizationId }: { organizationId: string }) {
  const { config, hasRole } = useAuth();
  const qc = useQueryClient();
  const [camerasQuota, setCamerasQuota] = useState('');
  const [storageQuotaGb, setStorageQuotaGb] = useState('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [billingStart, setBillingStart] = useState('');
  const [billingEnd, setBillingEnd] = useState('');

  const q = useQuery({
    queryKey: ['org-license', organizationId, config?.token],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      return apiGet<LicenseResponse>(config, `/v1/admin/organizations/${encodeURIComponent(organizationId)}/license`);
    },
    enabled: !!config && !!organizationId && hasRole('superadmin'),
  });

  useEffect(() => {
    const lic = q.data?.license;
    if (!lic) return;
    setCamerasQuota(String(lic.cameras_quota));
    setStorageQuotaGb(String(lic.storage_quota_gb));
    setBillingCycle(lic.billing_cycle === 'annual' ? 'annual' : 'monthly');
    setBillingStart(lic.billing_start ? lic.billing_start.slice(0, 10) : '');
    setBillingEnd(lic.billing_end ? lic.billing_end.slice(0, 10) : '');
  }, [q.data?.license]);

  const save = useMutation({
    mutationFn: async () => {
      if (!config) throw new Error('Not configured');
      const cq = Number(camerasQuota);
      const sq = Number(storageQuotaGb);
      const body: Record<string, unknown> = {
        cameras_quota: Number.isFinite(cq) ? cq : undefined,
        storage_quota_gb: Number.isFinite(sq) ? sq : undefined,
        billing_cycle: billingCycle,
      };
      if (billingStart) body.billing_start = new Date(billingStart + 'T12:00:00.000Z').toISOString();
      if (billingEnd) body.billing_end = new Date(billingEnd + 'T12:00:00.000Z').toISOString();
      return apiPut<LicenseResponse>(
        config,
        `/v1/admin/organizations/${encodeURIComponent(organizationId)}/license`,
        body
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['org-license', organizationId] });
    },
  });

  if (!hasRole('superadmin')) return null;
  if (q.isLoading) return <p className="text-sm text-slate-500">Loading license…</p>;

  return (
    <Card className="border-slate-800">
      <CardHeader className="py-3">
        <CardTitle className="text-base text-slate-100">Subscription entitlements (superadmin)</CardTitle>
        <p className="text-xs text-slate-500">
          Sets rows in <code className="text-slate-400">org_license_entitlements</code>. Sold capacity (e.g. 100
          cameras) is enforced when users add cameras under this organization.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate-200">
          Camera quota
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
            type="number"
            min={0}
            value={camerasQuota}
            onChange={(e) => setCamerasQuota(e.target.value)}
          />
        </label>
        <label className="text-sm text-slate-200">
          Storage quota (GB)
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
            type="number"
            min={0}
            value={storageQuotaGb}
            onChange={(e) => setStorageQuotaGb(e.target.value)}
          />
        </label>
        <label className="text-sm text-slate-200">
          Billing cycle
          <select
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
            value={billingCycle}
            onChange={(e) => setBillingCycle(e.target.value as 'monthly' | 'annual')}
          >
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
        </label>
        <label className="text-sm text-slate-200">
          Billing start (date)
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
            type="date"
            value={billingStart}
            onChange={(e) => setBillingStart(e.target.value)}
          />
        </label>
        <label className="text-sm text-slate-200 sm:col-span-2">
          Billing end / renewal (date)
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
            type="date"
            value={billingEnd}
            onChange={(e) => setBillingEnd(e.target.value)}
          />
        </label>
        <div className="sm:col-span-2">
          <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save entitlements'}
          </Button>
          {save.isError ? (
            <p className="mt-2 text-xs text-rose-400">
              {save.error instanceof Error ? save.error.message : 'Save failed'}
            </p>
          ) : null}
          {save.isSuccess ? <p className="mt-2 text-xs text-emerald-400">Saved.</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
