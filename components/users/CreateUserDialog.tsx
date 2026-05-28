'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { X, Loader2 } from 'lucide-react';
import { useAuth } from '@/app/providers/auth-provider';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api-client';
import type { Site, AuthUserRole, Organization } from '@/lib/types';

type UserRole = AuthUserRole;

export interface CreateUserDialogProps {
  defaultOrgId?: string;
  onClose: () => void;
  onCreated: () => void;
}

type EditUser = {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  site_ids: string[];
};

export interface EditUserDialogProps {
  user: EditUser;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

function UpsertUserDialog({
  mode,
  initialUser,
  defaultOrgId,
  onClose,
  onDone,
  onDeleted,
}: {
  mode: 'create' | 'edit';
  initialUser?: EditUser;
  defaultOrgId?: string;
  onClose: () => void;
  onDone: () => void;
  onDeleted?: () => void;
}) {
  const { config, hasRole, user: currentUser } = useAuth();
  const [email, setEmail] = useState(initialUser?.email ?? '');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(initialUser?.display_name ?? '');
  const [role, setRole] = useState<UserRole>(initialUser?.role ?? 'site_viewer');
  const [selectedOrgId, setSelectedOrgId] = useState<string>(mode === 'create' && defaultOrgId ? defaultOrgId : '');
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>(initialUser?.site_ids ?? []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const availableRoles: UserRole[] = hasRole('superadmin')
    ? ['superadmin', 'org_admin', 'site_admin', 'operator', 'site_viewer']
    : hasRole('org_admin')
      ? ['org_admin', 'site_admin', 'operator', 'site_viewer']
      : ['operator', 'site_viewer'];

  const { data: organizations = [] } = useQuery<Organization[]>({
    queryKey: ['organizations', config?.token],
    queryFn: async () => {
      if (!config) return [];
      const res = await apiGet<{ ok?: boolean; organizations?: Organization[] }>(config, '/v1/admin/tenants');
      return res?.organizations ?? [];
    },
    enabled: !!config && hasRole('superadmin'),
  });

  const { data: sites = [], isLoading: sitesLoading } = useQuery<Site[]>({
    queryKey: ['sites', config?.siteId],
    queryFn: async () => {
      if (!config) return [];
      const res = await apiGet<{ ok?: boolean; sites?: Site[] }>(config, '/v1/dashboard/sites');
      return res?.sites ?? [];
    },
    enabled: !!config,
  });

  const selectableSites = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'superadmin' || currentUser.role === 'org_admin') return sites;
    return sites.filter((s) => currentUser.site_ids.includes(s.site_id));
  }, [sites, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (mode === 'create' && !password.trim()) {
      setError('Password is required');
      return;
    }
    if (role === 'org_admin' && hasRole('superadmin') && !selectedOrgId) {
      setError('Select an organization for this org admin');
      return;
    }
    if (role !== 'superadmin' && role !== 'org_admin' && selectedSiteIds.length === 0) {
      setError('Select at least one site for this user');
      return;
    }
    if (!config) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === 'create') {
        const body: { email: string; password: string; display_name: string; role: UserRole; site_ids: string[]; org_id?: string } = {
          email: email.trim(),
          password,
          display_name: displayName.trim(),
          role,
          site_ids: role === 'superadmin' || role === 'org_admin' ? [] : selectedSiteIds,
        };
        if (selectedOrgId && (role === 'org_admin' || hasRole('superadmin'))) body.org_id = selectedOrgId;
        await apiPost(config, '/v1/admin/iam/users', body);
      } else {
        const body: { email?: string; password?: string; display_name?: string; role?: UserRole; site_ids?: string[]; org_id?: string } = {};
        body.email = email.trim();
        body.display_name = displayName.trim();
        if (password.trim()) body.password = password;
        if (initialUser && role !== initialUser.role) body.role = role;
        if (role !== 'superadmin' && role !== 'org_admin') body.site_ids = selectedSiteIds;
        await apiPut(config, `/v1/admin/iam/users/${initialUser!.id}`, body);
      }

      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === 'create' ? 'Failed to create user' : 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialUser) return;
    if (!config) return;
    if (!confirm(`Delete user ${initialUser.email}?`)) return;
    setLoading(true);
    setError(null);
    try {
      await apiDelete(config, `/v1/admin/iam/users/${initialUser.id}`);
      onDeleted?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  const toggleSite = (siteId: string) => {
    setSelectedSiteIds((prev) =>
      prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]
    );
  };

  const inputCls = 'w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">{mode === 'create' ? 'Create User' : 'Edit User'}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>
          )}
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-300">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="user@example.com" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-300">Display Name</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} placeholder="John Doe" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-300">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="••••••••" />
            {mode === 'edit' && <p className="text-xs text-slate-500">Leave blank to keep the current password.</p>}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-300">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={inputCls}>
              {availableRoles.map((r) => (
                <option key={r} value={r}>{r.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          {role === 'org_admin' && hasRole('superadmin') && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">Organization</label>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className={inputCls}
                required
              >
                <option value="">Select organization</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500">This user will be the org admin for the selected organization.</p>
            </div>
          )}
          {(role === 'site_admin' || role === 'operator' || role === 'site_viewer') && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Sites</label>
              <p className="text-xs text-slate-500">User will have access to the selected sites.</p>
              {sitesLoading ? (
                <div className="flex items-center gap-2 py-2 text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading sites…
                </div>
              ) : selectableSites.length === 0 ? (
                <p className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
                  No sites available to assign. Create sites first or ensure you have site access.
                </p>
              ) : (
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-slate-700 bg-slate-800 p-3">
                  {selectableSites.map((site) => (
                    <label key={site.site_id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={selectedSiteIds.includes(site.site_id)}
                        onChange={() => toggleSite(site.site_id)}
                        className="h-4 w-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{site.name}</span>
                      <span className="text-slate-500">({site.site_id})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-2 pt-2">
            {mode === 'edit' ? (
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading || (role === 'org_admin' && hasRole('superadmin') && !selectedOrgId) || ((role === 'site_admin' || role === 'operator' || role === 'site_viewer') && selectableSites.length > 0 && selectedSiteIds.length === 0)}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{mode === 'create' ? 'Creating...' : 'Saving...'}</> : mode === 'create' ? 'Create User' : 'Save'}
            </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CreateUserDialog({ defaultOrgId, onClose, onCreated }: CreateUserDialogProps) {
  return (
    <UpsertUserDialog
      mode="create"
      defaultOrgId={defaultOrgId}
      onClose={onClose}
      onDone={onCreated}
    />
  );
}

export function EditUserDialog({ user, onClose, onUpdated, onDeleted }: EditUserDialogProps) {
  return (
    <UpsertUserDialog
      mode="edit"
      initialUser={user}
      onClose={onClose}
      onDone={onUpdated}
      onDeleted={onDeleted}
    />
  );
}
