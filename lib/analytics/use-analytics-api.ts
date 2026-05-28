'use client';

import { parseEdgeServerList } from '@/components/edge-servers/contracts';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';
import { getConfig } from '@/app/lib/config';
import type { AIEvent, Incident, Site } from '@/lib/types';

export function useAnalyticsSites() {
  const config = typeof window !== 'undefined' ? getConfig() : null;
  return useQuery({
    queryKey: ['analytics-sites', config?.siteId],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const data = await apiGet<{ sites: Site[] }>(config, '/v1/dashboard/sites');
      return data?.sites ?? [];
    },
    enabled: !!config,
    staleTime: 60_000,
  });
}

export function useAnalyticsAiEvents(limit = 500) {
  const config = typeof window !== 'undefined' ? getConfig() : null;
  return useQuery({
    queryKey: ['analytics-ai-events', config?.siteId, limit],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const data = await apiGet<{ ok?: boolean; events?: AIEvent[] }>(config, `/v1/ai-events?limit=${limit}`);
      return data?.events ?? [];
    },
    enabled: !!config,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function useAnalyticsIncidents(limit = 300) {
  const config = typeof window !== 'undefined' ? getConfig() : null;
  return useQuery({
    queryKey: ['analytics-incidents', config?.siteId, limit],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const data = await apiGet<{ ok?: boolean; incidents?: Incident[] }>(config, `/v1/incidents?limit=${limit}`);
      return data?.incidents ?? [];
    },
    enabled: !!config,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

export type StorageReport = {
  recordings_bytes: number;
  exports_bytes: number;
  db_bytes: number;
  free_bytes: number | null;
  created_at: number;
};

export function useAnalyticsStorage() {
  const config = typeof window !== 'undefined' ? getConfig() : null;
  return useQuery({
    queryKey: ['analytics-storage', config?.siteId],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const data = await apiGet<{ ok?: boolean; data?: StorageReport | null }>(config, '/v1/dashboard/storage');
      return data?.data ?? null;
    },
    enabled: !!config,
    staleTime: 60_000,
  });
}

export type AuditLogEntry = {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: string;
  success: boolean;
};

export function useAnalyticsAuditLogs(limit = 300) {
  const config = typeof window !== 'undefined' ? getConfig() : null;
  return useQuery({
    queryKey: ['analytics-audit-logs', limit],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const data = await apiGet<{ ok?: boolean; entries?: AuditLogEntry[] }>(config, `/v1/audit-logs?limit=${limit}`);
      return data?.entries ?? [];
    },
    enabled: !!config,
    staleTime: 30_000,
  });
}



export type AnalyticsEdgeServerOption = {
  id: string;
  site_id: string;
  name: string;
  code: string;
  status: string;
  storage_capacity_gb: number | null;
};

export type AnalyticsEdgeNodeMetrics = {
  id: string;
  site_id?: string;
  name: string;
  site: string;
  diskFreeBytes: number | null;
  systemMetrics?: {
    hdd?: {
      mounts?: Array<{
        path: string;
        label: string;
        totalBytes: number;
        freeBytes: number;
        usedPercent: number;
      }>;
    };
  } | null;
};

function mapAnalyticsEdgeServer(s: import('@/components/edge-servers/types').EdgeServerRecord): AnalyticsEdgeServerOption {
  return {
    id: s.id,
    site_id: s.site_id,
    name: s.edge_server_name,
    code: s.edge_server_code,
    status: s.server_status,
    storage_capacity_gb: s.storage_capacity_gb,
  };
}
/** Edge servers registered in Admin (edge_servers table), not legacy edge_device rows. */
export function useSiteEdgeServers(siteId: string | null) {
  const config = typeof window !== 'undefined' ? getConfig() : null;
  return useQuery({
    queryKey: ['analytics-site-edge-servers', siteId],
    queryFn: async () => {
      if (!config || !siteId) throw new Error('Not configured');
      const params = new URLSearchParams({ page: '1', limit: '200', siteId });
      const raw = await apiGet<unknown>(config, `/v1/admin/edge-servers?${params.toString()}`);
      const { data } = parseEdgeServerList(raw);
      return data.filter((s) => !s.is_deleted).map(mapAnalyticsEdgeServer);
    },
    enabled: !!config && !!siteId,
    staleTime: 30_000,
  });
}

/** All edge servers in scope (for cross-site analytics). */
export function useAllEdgeServers() {
  const config = typeof window !== 'undefined' ? getConfig() : null;
  return useQuery({
    queryKey: ['analytics-all-edge-servers', config?.token],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const params = new URLSearchParams({ page: '1', limit: '500' });
      const raw = await apiGet<unknown>(config, `/v1/admin/edge-servers?${params.toString()}`);
      const { data } = parseEdgeServerList(raw);
      return data.filter((s) => !s.is_deleted).map(mapAnalyticsEdgeServer);
    },
    enabled: !!config,
    staleTime: 30_000,
  });
}

export function useAnalyticsEdgeNodes() {
  const config = typeof window !== 'undefined' ? getConfig() : null;
  return useQuery({
    queryKey: ['analytics-edge-nodes', config?.token],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const data = await apiGet<{ ok?: boolean; nodes?: AnalyticsEdgeNodeMetrics[] }>(
        config,
        '/v1/dashboard/edge-nodes',
      );
      return data?.nodes ?? [];
    },
    enabled: !!config,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
export function useSiteCamerasHealth(siteId: string | null) {
  const config = typeof window !== 'undefined' ? getConfig() : null;
  return useQuery({
    queryKey: ['analytics-site-cameras', siteId],
    queryFn: async () => {
      if (!config || !siteId) throw new Error('Not configured');
      const data = await apiGet<{ cameras: Array<{ camera_id: string; name?: string; status?: string }> }>(
        config,
        `/v1/dashboard/site/${siteId}/cameras`,
      );
      return data?.cameras ?? [];
    },
    enabled: !!config && !!siteId,
    staleTime: 30_000,
  });
}
