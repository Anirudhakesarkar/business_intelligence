import {
  isInstantInSIFilterPeriod,
  periodLengthDays,
  resolveSIFilterDates,
  resolveSIFilterInstantBounds,
} from '@/lib/school-intelligence/date-range';
import { fetchJsonStrict } from '@/lib/school-intelligence/fetch-json';
import { resolveOrganizationId } from '@/lib/school-intelligence/resolve-org-id';
import type {
  SIObservation,
  SIObservationSeverity,
  SIObservationStatus,
  SIStandardModuleConfig,
} from '@/lib/school-intelligence/module-standard/types';
import type { SIFilters } from '@/lib/school-intelligence/types';

type RawEvent = {
  id: number;
  eventType: string;
  module?: string;
  severity?: string;
  status?: string;
  startedAt?: string;
  detectedAt?: string;
  evidence?: { summary?: string };
  description?: string;
  cameraId?: number;
  zoneId?: number;
};

function eventBelongsToModule(
  event: RawEvent,
  config: SIStandardModuleConfig,
): boolean {
  const normalizedType = normalizeModuleEventType(config, event.eventType);
  if (config.eventTypes.includes(normalizedType)) return true;
  if (config.intelligenceModule && event.module === config.intelligenceModule) return true;
  return false;
}

function normalizeSeverity(value?: string): SIObservationSeverity {
  const s = (value ?? 'Medium').toLowerCase();
  if (s === 'critical') return 'Critical';
  if (s === 'high') return 'High';
  if (s === 'low') return 'Low';
  return 'Medium';
}

function normalizeStatus(value?: string): SIObservationStatus {
  const s = value ?? 'Open';
  if (s === 'Acknowledged' || s === 'Assigned' || s === 'Resolved' || s === 'Open') {
    return s;
  }
  return 'Observed';
}

export function normalizeModuleEventType(
  config: SIStandardModuleConfig,
  eventType: string,
): string {
  return config.eventTypeAliases?.[eventType] ?? eventType;
}

export function mapRawEventToObservation(
  event: RawEvent,
  config: SIStandardModuleConfig,
): SIObservation {
  const typeCfg = config.observationTypes.find((t) => t.type === event.eventType);
  return {
    id: event.id,
    type: event.eventType,
    label: typeCfg?.label ?? event.eventType.replace(/([A-Z])/g, ' $1').trim(),
    severity: normalizeSeverity(event.severity ?? typeCfg?.severity),
    status: normalizeStatus(event.status),
    startedAt: event.startedAt ?? event.detectedAt ?? new Date().toISOString(),
    summary:
      event.evidence?.summary ??
      event.description ??
      typeCfg?.defaultSummary ??
      'Observation recorded for this period.',
    cameraId: event.cameraId,
    location: event.zoneId != null ? `Zone #${event.zoneId}` : undefined,
  };
}

export function buildDemoObservations(
  config: SIStandardModuleConfig,
  filters: SIFilters,
): SIObservation[] {
  const { to: endIso } = resolveSIFilterInstantBounds(filters);
  const endMs = new Date(endIso).getTime();
  const { from: fromDate, to: toDate } = resolveSIFilterDates(filters);
  const dayCount = periodLengthDays(fromDate, toDate);

  const offsetsMinutes =
    filters.dateRange === '24h'
      ? [18, 42, 95, 130, 210, 360, 520, 680]
      : filters.dateRange === '30d'
        ? [60, 240, 720, 2880, 5760, 8640, 14400, 21600, 28800, 36000]
        : [30, 120, 360, 720, 1440, 2880, 4320, 5760, 7200, 8640];

  const siteSeed = filters.siteId
    .split('')
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  const orgSeed = filters.organizationId
    .split('')
    .reduce((a, c) => a + c.charCodeAt(0), 0);

  const rows: SIObservation[] = [];

  if (config.demoSeedAllTypes) {
    for (let t = 0; t < config.observationTypes.length; t++) {
      const minutesAgo = offsetsMinutes[t % offsetsMinutes.length] ?? 30;
      const startedAt = new Date(endMs - minutesAgo * 60_000).toISOString();
      if (!isInstantInSIFilterPeriod(startedAt, filters)) continue;
      const typeCfg = config.observationTypes[t];
      const demoSummary =
        typeCfg.demoSummaries?.[t % (typeCfg.demoSummaries.length || 1)] ??
        typeCfg.defaultSummary;
      rows.push({
        id: 8100 + t + config.id.length + siteSeed,
        type: typeCfg.type,
        label: typeCfg.label,
        severity: typeCfg.severity,
        status: 'Observed',
        startedAt,
        summary: demoSummary,
        cameraId: 10 + t,
      });
    }
    return rows.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
  }

  for (let i = 0; i < offsetsMinutes.length; i++) {
    const minutesAgo = offsetsMinutes[i];
    const startedAt = new Date(endMs - minutesAgo * 60_000).toISOString();
    if (!isInstantInSIFilterPeriod(startedAt, filters)) continue;
    const typeCfg =
      config.observationTypes[(i + siteSeed + orgSeed) % config.observationTypes.length];
    const demoSummary =
      typeCfg.demoSummaries?.[(i + siteSeed) % typeCfg.demoSummaries.length] ??
      typeCfg.defaultSummary;
    rows.push({
      id: 8000 + i + config.id.length + siteSeed,
      type: typeCfg.type,
      label: typeCfg.label,
      severity: typeCfg.severity,
      status: 'Observed',
      startedAt,
      summary: demoSummary,
      cameraId: 10 + i,
    });
    if (rows.length >= Math.min(config.observationTypes.length, Math.max(4, Math.ceil(dayCount * 0.8)))) {
      break;
    }
  }
  return rows;
}

export async function loadModuleObservations(
  config: SIStandardModuleConfig,
  filters: SIFilters,
  orgId = resolveOrganizationId(filters),
): Promise<SIObservation[]> {
  const { from, to } = resolveSIFilterInstantBounds(filters);
  const q = new URLSearchParams({
    organizationId: String(orgId),
    from,
    to,
  });
  if (filters.siteId) q.set('siteId', filters.siteId);
  const data = await fetchJsonStrict<{ events?: RawEvent[] }>(`/api/intelligence-events?${q}`);
  const mapped = (data.events ?? [])
    .filter((e) => eventBelongsToModule(e, config))
    .map((e) => ({
      ...e,
      eventType: normalizeModuleEventType(config, e.eventType),
    }))
    .map((e) => mapRawEventToObservation(e, config))
    .filter((e) => isInstantInSIFilterPeriod(e.startedAt, filters));

  return mapped;
}

export function filterPriorityObservations(observations: SIObservation[]): SIObservation[] {
  return observations.filter((o) => o.severity === 'Critical' || o.severity === 'High');
}

export function sortObservationsNewest(observations: SIObservation[]): SIObservation[] {
  return [...observations].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}
