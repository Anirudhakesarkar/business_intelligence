'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfDay } from 'date-fns';
import { apiGet } from '@/lib/api-client';
import { getConfig } from '@/app/lib/config';
import type { AIEvent, Incident, Site } from '@/lib/types';

export type DayCountPoint = { date: string; count: number };
export type TypeCountPoint = { event_type: string; count: number };
export type MapLocation = { site_id: string; name: string; lat: number; lng: number };

export type StorageData = {
  recordings_bytes: number;
  exports_bytes: number;
  db_bytes: number;
  free_bytes: number | null;
  created_at: number;
};

function siteIdSet(siteIds: string[]) {
  return new Set(siteIds);
}

export function filterBySites<T extends { site_id: string }>(rows: T[], siteIds: string[]): T[] {
  if (siteIds.length === 0) return [];
  const set = siteIdSet(siteIds);
  return rows.filter((r) => set.has(r.site_id));
}

export function aggregateEventsByDay(events: AIEvent[], days: number): DayCountPoint[] {
  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = subDays(new Date(), days - 1 - i);
    buckets.set(format(startOfDay(d), 'yyyy-MM-dd'), 0);
  }
  for (const e of events) {
    const t = Date.parse(e.start_ts);
    if (Number.isNaN(t)) continue;
    const key = format(startOfDay(new Date(t)), 'yyyy-MM-dd');
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
}

export function aggregateEventsByType(events: AIEvent[]): TypeCountPoint[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    const key = String(e.event_type ?? 'unknown').toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([event_type, count]) => ({ event_type, count }))
    .sort((a, b) => b.count - a.count);
}

export function mapLocationsFromSites(sites: Site[]): MapLocation[] {
  const out: MapLocation[] = [];
  for (const s of sites) {
    const lat = s.latitude;
    const lng = s.longitude;
    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      out.push({ site_id: s.site_id, name: s.name || s.site_id, lat, lng });
    }
  }
  return out;
}

export function useScopedAiEvents(siteIds: string[], limit = 2000, days = 14) {
  const config = typeof window !== 'undefined' ? getConfig() : null;
  const siteKey = [...siteIds].sort().join(',');

  return useQuery({
    queryKey: ['overview-ai-events', config?.siteId, siteKey, limit, days],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const start = startOfDay(subDays(new Date(), days - 1));
      const q = new URLSearchParams({
        start_ts: start.toISOString(),
        limit: String(limit),
      });
      const data = await apiGet<{ ok?: boolean; events?: AIEvent[] }>(config, `/v1/ai-events?${q.toString()}`);
      return filterBySites(data?.events ?? [], siteIds);
    },
    enabled: !!config && siteIds.length > 0,
    refetchInterval: 60_000,
  });
}

export function useScopedIncidents(siteIds: string[], limit = 500) {
  const config = typeof window !== 'undefined' ? getConfig() : null;
  const siteKey = [...siteIds].sort().join(',');

  return useQuery({
    queryKey: ['overview-incidents', config?.siteId, siteKey, limit],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const data = await apiGet<{ ok?: boolean; incidents?: Incident[] }>(
        config,
        `/v1/incidents?limit=${limit}`,
      );
      return filterBySites(data?.incidents ?? [], siteIds);
    },
    enabled: !!config && siteIds.length > 0,
    refetchInterval: 60_000,
  });
}

export function useScopedRecordingsByDay(siteIds: string[], days: number) {
  const config = typeof window !== 'undefined' ? getConfig() : null;
  const siteKey = [...siteIds].sort().join(',');

  return useQuery({
    queryKey: ['overview-recordings-day', config?.siteId, siteKey, days],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const data = await apiGet<{ ok?: boolean; data?: DayCountPoint[] }>(
        config,
        `/v1/dashboard/recordings-over-time?days=${days}`,
      );
      const apiRows = data?.data ?? [];
      const hasExports = apiRows.some((r) => r.count > 0);
      if (siteIds.length === 1 && siteIds[0] === config.siteId && hasExports) {
        return { points: apiRows, source: 'exports' as const };
      }
      return { points: [] as DayCountPoint[], source: 'exports' as const };
    },
    enabled: !!config && siteIds.length > 0,
    refetchInterval: 60_000,
  });
}

export function useScopedStorage(siteIds: string[]) {
  const config = typeof window !== 'undefined' ? getConfig() : null;
  const siteKey = [...siteIds].sort().join(',');

  return useQuery({
    queryKey: ['overview-storage', config?.siteId, siteKey],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      if (siteIds.length !== 1) return null;
      const data = await apiGet<{ ok?: boolean; data?: StorageData | null }>(config, '/v1/dashboard/storage');
      return data?.data ?? null;
    },
    enabled: !!config && siteIds.length === 1,
    refetchInterval: 60_000,
  });
}

export function useScopedMapLocations(siteIds: string[], sites: Site[]) {
  const config = typeof window !== 'undefined' ? getConfig() : null;
  const siteKey = [...siteIds].sort().join(',');

  const apiQuery = useQuery({
    queryKey: ['overview-map-locations', config?.siteId, siteKey],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const data = await apiGet<{ ok?: boolean; locations?: MapLocation[] }>(
        config,
        '/v1/dashboard/map-locations',
      );
      return data?.locations ?? [];
    },
    enabled: !!config && siteIds.length > 0,
    refetchInterval: 120_000,
  });

  const locations = useMemo(() => {
    const set = siteIdSet(siteIds);
    const fromApi = (apiQuery.data ?? []).filter((l) => set.has(l.site_id));
    if (fromApi.length > 0) return fromApi;
    return mapLocationsFromSites(sites.filter((s) => set.has(s.site_id)));
  }, [apiQuery.data, siteIds, sites]);

  return { ...apiQuery, data: locations };
}

export function useRecentAuditActors() {
  const config = typeof window !== 'undefined' ? getConfig() : null;

  return useQuery({
    queryKey: ['overview-audit-actors', config?.siteId],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const data = await apiGet<{
        ok?: boolean;
        entries?: Array<{ userId: string; timestamp: string; success: boolean }>;
      }>(config, '/v1/audit-logs?limit=200');
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const actors = new Set<string>();
      for (const e of data?.entries ?? []) {
        if (!e.success || !e.userId) continue;
        const t = Date.parse(e.timestamp);
        if (Number.isNaN(t) || t < cutoff) continue;
        actors.add(e.userId);
      }
      return actors.size;
    },
    enabled: !!config,
    refetchInterval: 120_000,
  });
}
