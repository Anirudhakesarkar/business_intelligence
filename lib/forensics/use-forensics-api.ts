'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';
import { getConfig } from '@/app/lib/config';
import type { AIEvent, Site } from '@/lib/types';

export function useForensicsSites() {
  const config = typeof window !== 'undefined' ? getConfig() : null;
  return useQuery({
    queryKey: ['forensics-sites', config?.siteId],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const data = await apiGet<{ sites: Site[] }>(config, '/v1/dashboard/sites');
      return data?.sites ?? [];
    },
    enabled: !!config,
    staleTime: 60_000,
  });
}

export function useForensicsCameras(enabled = true) {
  const config = typeof window !== 'undefined' ? getConfig() : null;
  return useQuery({
    queryKey: ['forensics-cameras', config?.siteId],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const data = await apiGet<{
        cameras: Array<{ camera_id: string; name: string; location?: string | null }>;
      }>(config, '/v1/cameras');
      return data?.cameras ?? [];
    },
    enabled: !!config && enabled,
    staleTime: 60_000,
  });
}

export type ForensicsAiEventsParams = {
  limit?: number;
  site_id?: string;
  camera_id?: string;
  event_type?: string;
  severity?: string;
  status?: string;
  start_ts?: string;
  end_ts?: string;
  enabled?: boolean;
};

export function useForensicsAiEvents(params: ForensicsAiEventsParams) {
  const config = typeof window !== 'undefined' ? getConfig() : null;
  const enabled = params.enabled !== false && !!config;
  return useQuery({
    queryKey: ['forensics-ai-events', config?.siteId, params],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const q = new URLSearchParams({ limit: String(params.limit ?? 300) });
      if (params.site_id) q.set('site_id', params.site_id);
      if (params.camera_id) q.set('camera_id', params.camera_id);
      if (params.event_type) q.set('event_type', params.event_type);
      if (params.severity) q.set('severity', params.severity);
      if (params.status) q.set('status', params.status);
      if (params.start_ts) q.set('start_ts', params.start_ts);
      if (params.end_ts) q.set('end_ts', params.end_ts);
      const data = await apiGet<{ ok?: boolean; events?: AIEvent[] }>(config, `/v1/ai-events?${q.toString()}`);
      return data?.events ?? [];
    },
    enabled,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
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

export function useForensicsAuditLogs(params: {
  limit?: number;
  action?: string;
  resource_type?: string;
  enabled?: boolean;
}) {
  const config = typeof window !== 'undefined' ? getConfig() : null;
  const enabled = params.enabled !== false && !!config;
  return useQuery({
    queryKey: ['forensics-audit-logs', params],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const q = new URLSearchParams({ limit: String(params.limit ?? 200) });
      if (params.action) q.set('action', params.action);
      if (params.resource_type) q.set('resource_type', params.resource_type);
      const data = await apiGet<{ ok?: boolean; entries?: AuditLogEntry[] }>(config, `/v1/audit-logs?${q.toString()}`);
      return data?.entries ?? [];
    },
    enabled,
    staleTime: 30_000,
  });
}
