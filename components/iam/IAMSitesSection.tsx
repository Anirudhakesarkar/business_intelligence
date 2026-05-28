'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getConfig } from '@/app/lib/config';
import { apiGet, apiPost } from '@/lib/api-client';
import type { Site } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Building2, RefreshCw, Plus, X, Loader2, Copy, CheckCircle2, KeyRound } from 'lucide-react';
import { useAuth } from '@/app/providers/auth-provider';

const SITES_DETAIL_BASE = '/dashboard/admin/iam/sites';

const VALIDITY_OPTIONS = [
  { value: 0, label: 'No expiry' },
  { value: 1, label: '1 month' },
  { value: 2, label: '2 months' },
  { value: 3, label: '3 months' },
  { value: 6, label: '6 months' },
  { value: 12, label: '12 months' },
  { value: 24, label: '24 months' },
];

function useSites() {
  const config = typeof window !== 'undefined' ? getConfig() : null;
  return useQuery({
    queryKey: ['admin-iam-sites', config?.siteId],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const data = await apiGet<{ sites: Array<{ site_id: string; id: string; name: string; org_id: string; status: string; api_key?: string; api_key_expires_at?: string | null; api_key_issued_at?: string | null }> }>(config, '/v1/admin/iam/sites');
      return (data?.sites ?? []).map((s) => ({
        site_id: s.site_id || s.id,
        name: s.name,
        org_id: s.org_id,
        status: (s.status === 'active' ? 'ONLINE' : 'OFFLINE') as Site['status'],
        last_seen_at: null,
        statusSummary: { OK: 0, WARN: 0, CRITICAL: 0, OFFLINE: 0 },
        api_key_expires_at: s.api_key_expires_at ?? null,
        api_key_issued_at: s.api_key_issued_at ?? null,
      }));
    },
    enabled: !!config,
    refetchInterval: 10_000,
  });
}

type IAMSitesSectionProps = {
  selectedOrgId?: string | null;
};

type SiteWithExpiry = Site & { api_key_expires_at?: string | null; api_key_issued_at?: string | null };

type CredentialInfo = {
  site_id: string;
  name: string;
  api_key: string;
  api_key_expires_at?: string | null;
  api_key_issued_at?: string | null;
};

export function IAMSitesSection({ selectedOrgId }: IAMSitesSectionProps = {}) {
  const { config, hasRole, user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: allSites = [], isLoading, error, refetch } = useSites();

  let sites: SiteWithExpiry[] =
    currentUser && currentUser.role !== 'superadmin' && currentUser.role !== 'org_admin'
      ? allSites.filter((s) => currentUser.site_ids.includes(s.site_id))
      : allSites;
  if (currentUser?.role === 'superadmin' && selectedOrgId) {
    sites = sites.filter((s) => s.org_id === selectedOrgId);
  }

  const canCreateSite = hasRole('superadmin', 'org_admin');
  const canRotateKey = hasRole('superadmin', 'org_admin');

  // ── Create site state ──────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addId, setAddId] = useState('');
  const [addValidity, setAddValidity] = useState(0);
  const [addError, setAddError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<CredentialInfo | null>(null);
  const [copiedField, setCopiedField] = useState<'site_id' | 'api_key' | null>(null);

  // ── Rotate / revoke state ──────────────────────────────────────
  const [rotateTarget, setRotateTarget] = useState<{ site_id: string; name: string } | null>(null);
  const [rotateValidity, setRotateValidity] = useState(0);
  const [rotateResult, setRotateResult] = useState<CredentialInfo | null>(null);
  const [rotateError, setRotateError] = useState<string | null>(null);

  // ── Mutations ──────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (body: { name: string; id?: string; api_key_validity_months?: number }) => {
      if (!config) throw new Error('Not configured');
      const payload = currentUser?.role === 'superadmin' && selectedOrgId
        ? { ...body, org_id: selectedOrgId }
        : body;
      return apiPost<{
        ok: boolean;
        site?: { site_id: string; id: string; name: string; org_id?: string; api_key: string; api_key_expires_at?: string | null; api_key_issued_at?: string | null };
      }>(config, '/v1/admin/iam/sites', payload);
    },
    onSuccess: (res) => {
      if (res?.ok && (res.site?.site_id || res.site?.id) && res.site?.api_key) {
        setCreatedCredentials({
          site_id: res.site.site_id || res.site.id,
          name: res.site.name,
          api_key: res.site.api_key,
          api_key_expires_at: res.site.api_key_expires_at,
          api_key_issued_at: res.site.api_key_issued_at,
        });
        setAddError(null);
        queryClient.invalidateQueries({ queryKey: ['admin-iam-sites'] });
      }
    },
    onError: (err) => {
      setAddError(err instanceof Error ? err.message : 'Failed to create site');
    },
  });

  const rotateMutation = useMutation({
    mutationFn: async ({ siteId, api_key_validity_months }: { siteId: string; api_key_validity_months?: number }) => {
      if (!config) throw new Error('Not configured');
      return apiPost<{
        ok: boolean;
        site?: { site_id: string; id: string; name: string; api_key: string; api_key_expires_at?: string | null; api_key_issued_at?: string | null };
      }>(config, `/v1/admin/iam/sites/${siteId}/rotate-key`, { api_key_validity_months });
    },
    onSuccess: (res) => {
      if (res?.ok && res.site) {
        setRotateResult({
          site_id: res.site.site_id || res.site.id,
          name: res.site.name,
          api_key: res.site.api_key,
          api_key_expires_at: res.site.api_key_expires_at,
          api_key_issued_at: res.site.api_key_issued_at,
        });
        setRotateError(null);
        queryClient.invalidateQueries({ queryKey: ['admin-iam-sites'] });
      }
    },
    onError: (err) => {
      setRotateError(err instanceof Error ? err.message : 'Failed to rotate API key');
    },
  });

  // ── Helpers ────────────────────────────────────────────────────
  const handleCopy = async (field: 'site_id' | 'api_key', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch { /* clipboard not available */ }
  };

  const handleCloseCredentials = () => {
    setCreatedCredentials(null);
    setAddOpen(false);
    setAddName('');
    setAddId('');
    setAddValidity(0);
    setCopiedField(null);
  };

  const handleCloseRotate = () => {
    setRotateTarget(null);
    setRotateResult(null);
    setRotateValidity(0);
    setRotateError(null);
    setCopiedField(null);
  };

  const formatExpiry = (iso: string | null | undefined) => {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const isExpired = (iso: string | null | undefined) => {
    if (!iso) return false;
    return new Date(iso) < new Date();
  };

  // Matches how the backend computes expiry via JS `setMonth(...)` in `SiteRepo.computeExpiry`.
  const addMonthsJS = (base: Date, months: number) => {
    const d = new Date(base.getTime());
    d.setMonth(d.getMonth() + months);
    return d;
  };

  // Calendar-month floor using JS month overflow semantics.
  const monthDiffFloorJS = (start: Date, end: Date, maxMonths = 120) => {
    if (end <= start) return 0;
    let lo = 0;
    let hi = maxMonths + 1;
    while (lo + 1 < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (addMonthsJS(start, mid).getTime() <= end.getTime()) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return lo;
  };

  // ── Shared credentials display ─────────────────────────────────
  const CredentialDisplay = ({ creds, onDone }: { creds: CredentialInfo; onDone: () => void }) => (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>Site &quot;{creds.name}&quot; — new credentials ready. Copy them now.</span>
      </div>
      <p className="text-xs text-slate-500">
        Use these in the edge app (renderer) to enable sync. The API key won&apos;t be shown again.
      </p>
      <div>
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Site ID</label>
        <div className="mt-1 flex items-center gap-2">
          <code className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 font-mono break-all">
            {creds.site_id}
          </code>
          <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => handleCopy('site_id', creds.site_id)}>
            {copiedField === 'site_id' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">API key</label>
        <div className="mt-1 flex items-center gap-2">
          <code className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 font-mono break-all select-all">
            {creds.api_key}
          </code>
          <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => handleCopy('api_key', creds.api_key)}>
            {copiedField === 'api_key' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {creds.api_key_expires_at && (
        <div className="rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-400">
          Expires: <span className="text-slate-200">{formatExpiry(creds.api_key_expires_at)}</span>
        </div>
      )}
      {creds.api_key_issued_at && (
        <div className="rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-400">
          {(() => {
            const issuedAt = new Date(creds.api_key_issued_at!);
            const now = new Date();
            const usedMonths = monthDiffFloorJS(issuedAt, now);
            if (creds.api_key_expires_at) {
              const expiresAt = new Date(creds.api_key_expires_at);
              const validityMonths = monthDiffFloorJS(issuedAt, expiresAt);
              const remainingMonths = monthDiffFloorJS(now, expiresAt);
              return (
                <>
                  Used: <span className="text-slate-200">{usedMonths}m</span> • Validity: <span className="text-slate-200">{validityMonths}m</span> • Remaining: <span className="text-slate-200">{remainingMonths}m</span>
                </>
              );
            }
            return (
              <>
                Used: <span className="text-slate-200">{usedMonths}m</span> • Remaining: <span className="text-slate-200">Never</span>
              </>
            );
          })()}
        </div>
      )}
      <Button className="w-full" onClick={onDone}>Done</Button>
    </div>
  );

  const ValiditySelector = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div>
      <label className="text-sm font-medium text-slate-300">API key validity</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {VALIDITY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="flex items-center gap-2 text-base text-slate-100">
            <Building2 className="h-4 w-4 text-slate-400" />
            Sites
          </CardTitle>
          {canCreateSite && (
            <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add site
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          {error && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              {error instanceof Error ? error.message : 'Failed to load sites'}
              <Button variant="ghost" size="sm" className="mt-2 gap-1" onClick={() => refetch()}>
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          )}
          {!isLoading && !error && (
            <>
              {sites.length === 0 ? (
                <p className="py-8 text-center text-slate-500">
                  {canCreateSite ? 'No sites yet. Add your first site.' : 'No sites found.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {sites.map((site) => (
                    <div
                      key={site.site_id}
                      className="rounded-lg border border-slate-800 p-3 transition-colors hover:bg-slate-800/50"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <Link
                          href={`${SITES_DETAIL_BASE}/${site.site_id}`}
                          className="flex min-w-0 items-center gap-3 flex-1"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800">
                            <Building2 className="h-4 w-4 text-slate-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-100">{site.name}</p>
                            <div className="flex items-center gap-2">
                              <span className="truncate text-xs text-slate-500">{site.site_id}</span>
                              {site.api_key_expires_at ? (
                                <span className={`text-xs ${isExpired(site.api_key_expires_at) ? 'text-red-400' : 'text-slate-500'}`}>
                                  {isExpired(site.api_key_expires_at) ? 'Key expired' : `Key expires ${formatExpiry(site.api_key_expires_at)}`}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-500">No expiry</span>
                              )}
                              {site.api_key_issued_at && (
                                <span className="truncate text-xs text-slate-500">
                                  {(() => {
                                    const issuedAt = new Date(site.api_key_issued_at!);
                                    const now = new Date();
                                    const usedMonths = monthDiffFloorJS(issuedAt, now);
                                    if (site.api_key_expires_at) {
                                      const expiresAt = new Date(site.api_key_expires_at);
                                      const validityMonths = monthDiffFloorJS(issuedAt, expiresAt);
                                      const remainingMonths = monthDiffFloorJS(now, expiresAt);
                                      return `Used: ${usedMonths}m • Validity: ${validityMonths}m • Remaining: ${remainingMonths}m`;
                                    }
                                    return `Used: ${usedMonths}m • Remaining: Never`;
                                  })()}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-wrap gap-x-2 text-xs text-slate-500">
                            <span>OK: {site.statusSummary?.OK ?? 0}</span>
                            <span className="text-yellow-500">WARN: {site.statusSummary?.WARN ?? 0}</span>
                            <span className="text-red-500">CRIT: {site.statusSummary?.CRITICAL ?? 0}</span>
                          </div>
                          <Badge variant={site.status === 'ONLINE' ? 'success' : 'secondary'} className="shrink-0 text-xs">
                            {site.status}
                          </Badge>
                          {canRotateKey && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Revoke access / rotate API key"
                              className="shrink-0 text-slate-400 hover:text-amber-400"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRotateTarget({ site_id: site.site_id, name: site.name });
                              }}
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Create site modal ───────────────────────────────────── */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-md border-slate-700 bg-slate-900">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-slate-100">
                {createdCredentials ? 'Site credentials' : 'Add site'}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => (createdCredentials ? handleCloseCredentials() : setAddOpen(false))}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {createdCredentials ? (
                <CredentialDisplay creds={createdCredentials} onDone={handleCloseCredentials} />
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setAddError(null);
                    if (!addName.trim()) {
                      setAddError('Site name is required');
                      return;
                    }
                    createMutation.mutate({
                      name: addName.trim(),
                      id: addId.trim() || undefined,
                      api_key_validity_months: addValidity || undefined,
                    });
                  }}
                  className="space-y-4"
                >
                  {addError && (
                    <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{addError}</div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-slate-300">Name *</label>
                    <input
                      type="text"
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      placeholder="e.g. Mumbai Campus"
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-300">Site ID (optional)</label>
                    <input
                      type="text"
                      value={addId}
                      onChange={(e) => setAddId(e.target.value)}
                      placeholder="e.g. mumbai-campus"
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <ValiditySelector value={addValidity} onChange={setAddValidity} />
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Create
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Rotate / revoke key modal ───────────────────────────── */}
      {rotateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-md border-slate-700 bg-slate-900">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-slate-100">
                {rotateResult ? 'New API key' : 'Revoke access'}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={handleCloseRotate}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {rotateResult ? (
                <CredentialDisplay creds={rotateResult} onDone={handleCloseRotate} />
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                    This will generate a new API key for <strong>{rotateTarget.name}</strong>.
                    The old key will stop working immediately — the renderer will stop syncing until reconfigured with the new key.
                  </div>
                  <ValiditySelector value={rotateValidity} onChange={setRotateValidity} />
                  {rotateError && (
                    <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{rotateError}</div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="destructive"
                      disabled={rotateMutation.isPending}
                      onClick={() => {
                        setRotateError(null);
                        rotateMutation.mutate({
                          siteId: rotateTarget.site_id,
                          api_key_validity_months: rotateValidity || undefined,
                        });
                      }}
                    >
                      {rotateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <KeyRound className="h-4 w-4 mr-1" />}
                      Revoke &amp; generate new key
                    </Button>
                    <Button type="button" variant="outline" onClick={handleCloseRotate}>Cancel</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
