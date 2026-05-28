import { format, subDays, startOfDay } from 'date-fns';
import type { AIEvent, Incident } from '@/lib/types';

export function parseIsoMs(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

export function parseIncidentMs(inc: Incident, field: 'created' | 'resolved'): number | null {
  const raw = field === 'created' ? inc.created_at : inc.resolved_at;
  if (raw == null) return null;
  if (typeof raw === 'string') return parseIsoMs(raw);
  return raw < 1e12 ? raw * 1000 : raw;
}


export function filterEventsByScope(
  events: AIEvent[],
  siteId: string | null | undefined,
  edgeDeviceId: string | null | undefined,
  options?: { singleEdgeDeviceAtSite?: boolean },
): AIEvent[] {
  const site = siteId && siteId !== 'all' ? siteId : null;
  const device = edgeDeviceId && edgeDeviceId !== 'all' ? edgeDeviceId : null;
  if (!site && !device) return events;
  return events.filter((e) => {
    if (site && e.site_id !== site) return false;
    if (device) {
      const id = e.edge_device_id?.trim();
      if (id) return id === device;
      if (options?.singleEdgeDeviceAtSite && site && e.site_id === site) return true;
      return false;
    }
    return true;
  });
}
export function filterEventsInDays(events: AIEvent[], days: number): AIEvent[] {
  const cutoff = startOfDay(subDays(new Date(), days - 1)).getTime();
  return events.filter((e) => {
    const t = parseIsoMs(e.start_ts);
    return t != null && t >= cutoff;
  });
}

export function filterIncidentsInDays(incidents: Incident[], days: number): Incident[] {
  const cutoff = startOfDay(subDays(new Date(), days - 1)).getTime();
  return incidents.filter((i) => {
    const t = parseIncidentMs(i, 'created');
    return t != null && t >= cutoff;
  });
}

export function aggregateEventsPerDay(events: AIEvent[], days: number) {
  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = subDays(new Date(), days - 1 - i);
    buckets.set(format(d, 'yyyy-MM-dd'), 0);
  }
  for (const e of filterEventsInDays(events, days)) {
    const t = parseIsoMs(e.start_ts);
    if (t == null) continue;
    const key = format(new Date(t), 'yyyy-MM-dd');
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([date, alerts]) => ({
    date,
    label: format(new Date(date), 'EEE d'),
    alerts,
  }));
}

export function aggregateEventsPerHour(events: AIEvent[], days: number) {
  const filtered = filterEventsInDays(events, days);
  const buckets = Array.from({ length: 24 }, () => 0);
  for (const e of filtered) {
    const t = parseIsoMs(e.start_ts);
    if (t == null) continue;
    buckets[new Date(t).getHours()] += 1;
  }
  return buckets.map((eventsCount, h) => ({
    hour: `${String(h).padStart(2, '0')}:00`,
    hourNum: h,
    events: eventsCount,
  }));
}

export function aggregateTopCameras(
  events: AIEvent[],
  days: number,
  siteNameById: Map<string, string>,
  limit = 8,
) {
  const filtered = filterEventsInDays(events, days);
  const counts = new Map<string, { cameraId: string; name: string; site: string; alerts: number }>();
  for (const e of filtered) {
    const key = e.camera_id;
    const existing = counts.get(key);
    if (existing) existing.alerts += 1;
    else {
      counts.set(key, {
        cameraId: e.camera_id,
        name: e.camera_name ?? e.camera_id,
        site: siteNameById.get(e.site_id) ?? e.site_id,
        alerts: 1,
      });
    }
  }
  return Array.from(counts.values())
    .sort((a, b) => b.alerts - a.alerts)
    .slice(0, limit)
    .map((c, i) => ({ id: c.cameraId || `cam-${i}`, ...c }));
}

export type ResolutionRow = {
  id: string;
  title: string;
  severity: string;
  created_at: number;
  resolved_at: number;
  resolutionMinutes: number;
  resolutionLabel: string;
};

export function aggregateResolutionTimes(incidents: Incident[]): ResolutionRow[] {
  return incidents
    .map((inc) => {
      const created = parseIncidentMs(inc, 'created');
      const resolved = parseIncidentMs(inc, 'resolved');
      if (created == null || resolved == null) return null;
      const mins = Math.round((resolved - created) / 60_000);
      if (mins < 0) return null;
      return {
        id: inc.incident_id,
        title: inc.title,
        severity: String(inc.severity ?? 'medium').toLowerCase(),
        created_at: created,
        resolved_at: resolved,
        resolutionMinutes: mins,
        resolutionLabel: mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`,
      };
    })
    .filter((r): r is ResolutionRow => r != null)
    .sort((a, b) => a.resolutionMinutes - b.resolutionMinutes);
}

export function aggregateEventHeatmap(events: AIEvent[], days: number) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const e of filterEventsInDays(events, days)) {
    const t = parseIsoMs(e.start_ts);
    if (t == null) continue;
    const d = new Date(t);
    grid[d.getDay()][d.getHours()] += 1;
  }
  return grid.map((hours, dayIndex) => ({ dayName: dayNames[dayIndex], dayIndex, hours }));
}

export function aggregateWeekComparison(events: AIEvent[]) {
  const now = new Date();
  const days = 7;
  return Array.from({ length: days }, (_, i) => {
    const date = subDays(now, days - 1 - i);
    const dayStart = startOfDay(date).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
    const lastDayStart = dayStart - 7 * 24 * 60 * 60 * 1000;
    const lastDayEnd = lastDayStart + 24 * 60 * 60 * 1000 - 1;
    let thisWeek = 0;
    let lastWeek = 0;
    for (const e of events) {
      const t = parseIsoMs(e.start_ts);
      if (t == null) continue;
      if (t >= dayStart && t <= dayEnd) thisWeek += 1;
      if (t >= lastDayStart && t <= lastDayEnd) lastWeek += 1;
    }
    return { label: format(date, 'EEE'), date: format(date, 'yyyy-MM-dd'), thisWeek, lastWeek };
  });
}

export function aggregateEventTypes(events: AIEvent[], days: number) {
  const filtered = filterEventsInDays(events, days);
  const counts = new Map<string, number>();
  for (const e of filtered) {
    const key = String(e.event_type ?? 'unknown').toUpperCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return Array.from(counts.entries())
    .map(([id, count]) => {
      const pattern = Array.from({ length: 7 }, () => 0);
      for (const e of filtered) {
        if (String(e.event_type ?? '').toUpperCase() !== id) continue;
        const t = parseIsoMs(e.start_ts);
        if (t == null) continue;
        pattern[new Date(t).getDay()] += 1;
      }
      return {
        id: id.toLowerCase(),
        label: id.replace(/_/g, ' '),
        count,
        pattern,
        dayBreakdown: pattern.map((v, i) => ({ day: dayNames[i], count: v })),
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export function aggregateAiAccuracy(events: AIEvent[], days: number) {
  const filtered = filterEventsInDays(events, days);
  const total = filtered.length;
  const bySeverity = { critical: 0, warning: 0, info: 0 };
  const byStatus = new Map<string, number>();
  const byType = new Map<string, number>();
  let withClip = 0;
  let linkedIncident = 0;
  for (const e of filtered) {
    const sev = String(e.severity ?? '').toLowerCase();
    if (sev === 'critical' || sev === 'high') bySeverity.critical += 1;
    else if (sev === 'warning' || sev === 'warn') bySeverity.warning += 1;
    else bySeverity.info += 1;
    const st = String(e.status ?? 'unknown');
    byStatus.set(st, (byStatus.get(st) ?? 0) + 1);
    const ty = String(e.event_type ?? 'unknown');
    byType.set(ty, (byType.get(ty) ?? 0) + 1);
    if (e.clip_url) withClip += 1;
    if (e.incident_id) linkedIncident += 1;
  }
  const dismissed = (byStatus.get('dismissed') ?? 0) + (byStatus.get('false_positive') ?? 0);
  return {
    total,
    bySeverity,
    byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })),
    byType: Array.from(byType.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count).slice(0, 12),
    withClip,
    linkedIncident,
    falsePositiveRate: total > 0 ? dismissed / total : 0,
  };
}

export function aggregateIncidentsBySite(incidents: Incident[], siteNameById: Map<string, string>, days: number) {
  const filtered = filterIncidentsInDays(incidents, days);
  const counts = new Map<string, number>();
  for (const inc of filtered) {
    const name = siteNameById.get(inc.site_id) ?? inc.site_id;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([site, count]) => ({ site, count })).sort((a, b) => b.count - a.count);
}



export type EdgeStorageRow = {
  edgeServerId: string;
  edgeServerName: string;
  siteId: string;
  siteName: string;
  usedBytes: number;
  totalBytes: number;
  usedPct: number;
  source: 'disk-metrics' | 'capacity' | 'site-report' | 'unavailable';
};

type HddMount = {
  label?: string;
  totalBytes?: number;
  freeBytes?: number;
  usedPercent?: number;
};

type EdgeNodeForStorage = {
  id: string;
  site_id?: string;
  systemMetrics?: { hdd?: { mounts?: HddMount[] } } | null;
};

type EdgeServerForStorage = {
  id: string;
  site_id: string;
  name: string;
  storage_capacity_gb: number | null;
};

function pickPrimaryMount(node: EdgeNodeForStorage | undefined): HddMount | null {
  const mounts = node?.systemMetrics?.hdd?.mounts ?? [];
  if (!mounts.length) return null;
  const vms = mounts.find((m) => (m.label || '').toLowerCase().includes('vms volume'));
  return vms ?? mounts[0] ?? null;
}

function matchEdgeNode(servers: EdgeServerForStorage[], nodes: EdgeNodeForStorage[], server: EdgeServerForStorage) {
  const atSite = nodes.filter((n) => n.site_id === server.site_id);
  const byId = atSite.find((n) => n.id === server.id);
  if (byId) return byId;
  if (atSite.length === 1 && servers.filter((s) => s.site_id === server.site_id).length === 1) return atSite[0];
  return atSite[0] ?? null;
}

export function buildEdgeServerStorageRows(
  servers: EdgeServerForStorage[],
  nodes: EdgeNodeForStorage[],
  siteNameById: Map<string, string>,
  siteStorage?: { siteId: string; usedBytes: number; freeBytes: number | null } | null,
): EdgeStorageRow[] {
  if (servers.length === 0) return [];

  const siteServerCount = new Map<string, number>();
  for (const s of servers) {
    siteServerCount.set(s.site_id, (siteServerCount.get(s.site_id) ?? 0) + 1);
  }

  const rows: EdgeStorageRow[] = [];

  for (const server of servers) {
    const siteName = siteNameById.get(server.site_id) ?? server.site_id;
    const node = matchEdgeNode(servers, nodes, server);
    const mount = pickPrimaryMount(node ?? undefined);

    if (mount && mount.totalBytes != null && mount.totalBytes > 0) {
      const totalBytes = mount.totalBytes;
      const freeBytes = mount.freeBytes ?? 0;
      const usedBytes = Math.max(0, totalBytes - freeBytes);
      const usedPct = mount.usedPercent != null ? Math.round(mount.usedPercent) : Math.min(100, Math.round((usedBytes / totalBytes) * 100));
      rows.push({
        edgeServerId: server.id,
        edgeServerName: server.name,
        siteId: server.site_id,
        siteName,
        usedBytes,
        totalBytes,
        usedPct,
        source: 'disk-metrics',
      });
      continue;
    }

    const capGb = server.storage_capacity_gb;
    if (capGb != null && capGb > 0) {
      const totalBytes = capGb * 1024 ** 3;
      rows.push({
        edgeServerId: server.id,
        edgeServerName: server.name,
        siteId: server.site_id,
        siteName,
        usedBytes: 0,
        totalBytes,
        usedPct: 0,
        source: 'capacity',
      });
      continue;
    }

    rows.push({
      edgeServerId: server.id,
      edgeServerName: server.name,
      siteId: server.site_id,
      siteName,
      usedBytes: 0,
      totalBytes: 0,
      usedPct: 0,
      source: 'unavailable',
    });
  }

  // Allocate site-level storage report across sites with a single edge server (no per-disk metrics)
  if (siteStorage && siteStorage.usedBytes > 0 && (siteServerCount.get(siteStorage.siteId) ?? 0) === 1) {
    const server = servers.find((s) => s.site_id === siteStorage.siteId);
    if (server) {
      const idx = rows.findIndex((r) => r.edgeServerId === server.id);
      if (idx >= 0 && rows[idx].source === 'unavailable') {
        const free = siteStorage.freeBytes ?? 0;
        const totalBytes = siteStorage.usedBytes + free;
        const usedPct = totalBytes > 0 ? Math.min(100, Math.round((siteStorage.usedBytes / totalBytes) * 100)) : 0;
        rows[idx] = {
          ...rows[idx],
          usedBytes: siteStorage.usedBytes,
          totalBytes,
          usedPct,
          source: 'site-report',
        };
      }
    }
  }

  return rows.sort((a, b) => b.usedBytes - a.usedBytes);
}

export function formatStorageAmount(bytes: number): string {
  if (bytes <= 0) return '0 GB';
  const tb = bytes / 1024 ** 4;
  if (tb >= 0.1) return `${tb.toFixed(2)} TB`;
  const gb = bytes / 1024 ** 3;
  return `${gb.toFixed(1)} GB`;
}
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} GB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} TB`;
}
