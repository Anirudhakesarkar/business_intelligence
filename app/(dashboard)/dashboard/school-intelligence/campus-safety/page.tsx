'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { CampusSafetyScorePanel } from '@/components/school-intelligence/campus-safety/CampusSafetyScorePanel';
import { SafetyEventFeed, type ObservationFilter } from '@/components/school-intelligence/campus-safety/SafetyEventFeed';
import { useSchoolOverallScore, useSchoolScoreCompare } from '@/components/school-intelligence/useSchoolScores';
import {
  formatSIFilterPeriodLabel,
  isInstantInSIFilterPeriod,
  periodLengthDays,
  resolveSIFilterDates,
  resolveSIFilterInstantBounds,
  scoreCompareLabel,
} from '@/lib/school-intelligence/date-range';
import {
  WifiOff,
  AlertTriangle,
  Flame,
  ShieldAlert,
  BarChart3,
  DoorOpen,
  Users,
} from 'lucide-react';
import {
  CAMPUS_SAFETY_CRITICAL_TYPES,
  CAMPUS_SAFETY_EVENT_TYPES,
  CAMPUS_SAFETY_HIGH_TYPES,
  CAMPUS_SAFETY_OBSERVATION_TYPES,
  CAMPUS_SAFETY_TYPE_LABELS,
} from '@/lib/school-intelligence/campus-safety-observation-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePageHeaderRefresh } from '@/components/layout/page-header-context';
import { SchoolIntelligenceBreadcrumbs } from '@/components/school-intelligence/SchoolIntelligenceBreadcrumbs';
import { SIFilterBar } from '@/components/school-intelligence/SIFilterBar';
import { resolveOrganizationId } from '@/lib/school-intelligence/resolve-org-id';
import { useCameras, useZones } from '@/components/school-management/useSchoolFoundation';
import { useQuery } from '@tanstack/react-query';
import type { SIFilters } from '@/lib/school-intelligence/types';

type SafetyEvent = {
  id: number;
  eventType: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'Acknowledged' | 'Assigned' | 'Resolved';
  startedAt: string;
  evidence: { summary: string };
  cameraId?: number;
  zoneId?: number;
};

const EVENT_ICONS: Record<string, React.ReactNode> = {
  FallDetected: <AlertTriangle className="h-4 w-4 text-red-400" />,
  FireSmokeDetected: <Flame className="h-4 w-4 text-red-500" />,
  FireExitObstruction: <Flame className="h-4 w-4 text-orange-400" />,
  EmergencyExitCrowding: <DoorOpen className="h-4 w-4 text-red-400" />,
  CriticalCameraOffline: <WifiOff className="h-4 w-4 text-amber-400" />,
  RestrictedZoneEntry: <ShieldAlert className="h-4 w-4 text-orange-400" />,
  ServerRoomEntry: <ShieldAlert className="h-4 w-4 text-orange-400" />,
  UnsafeClimbing: <AlertTriangle className="h-4 w-4 text-amber-400" />,
  RunningDetected: <AlertTriangle className="h-4 w-4 text-blue-400" />,
  Loitering: <Users className="h-4 w-4 text-amber-400" />,
  VehicleStudentOverlap: <AlertTriangle className="h-4 w-4 text-orange-400" />,
};

const TYPE_GRID_ICONS: Record<string, React.ReactNode> = {
  FallDetected: <AlertTriangle className="h-3.5 w-3.5 text-red-400" />,
  FireSmokeDetected: <Flame className="h-3.5 w-3.5 text-red-500" />,
  FireExitObstruction: <Flame className="h-3.5 w-3.5 text-orange-400" />,
  EmergencyExitCrowding: <DoorOpen className="h-3.5 w-3.5 text-red-400" />,
  CriticalCameraOffline: <WifiOff className="h-3.5 w-3.5 text-amber-400" />,
  RestrictedZoneEntry: <ShieldAlert className="h-3.5 w-3.5 text-orange-400" />,
  ServerRoomEntry: <ShieldAlert className="h-3.5 w-3.5 text-orange-400" />,
  UnsafeClimbing: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />,
  RunningDetected: <AlertTriangle className="h-3.5 w-3.5 text-blue-400" />,
  Loitering: <Users className="h-3.5 w-3.5 text-amber-400" />,
  VehicleStudentOverlap: <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />,
};

type IncidentBucket = { key: string; label: string; subLabel?: string; count: number };

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeekday(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function formatMonthLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

/** Build time buckets from the active date-range filter. */
function buildIncidentBuckets(filters: SIFilters): Omit<IncidentBucket, 'count'>[] {
  const { from, to } = resolveSIFilterDates(filters);
  const dayCount = periodLengthDays(from, to);

  if (filters.dateRange === '24h') {
    const end = Date.now();
    return Array.from({ length: 12 }).map((_, i) => {
      const slotEnd = new Date(end - (11 - i) * 2 * 60 * 60 * 1000);
      const label = slotEnd.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return { key: `h-${i}`, label };
    });
  }

  if (dayCount <= 31) {
    const buckets: Omit<IncidentBucket, 'count'>[] = [];
    let cur = from;
    while (cur <= to) {
      buckets.push({
        key: cur,
        label: formatDayLabel(cur),
        subLabel: formatWeekday(cur),
      });
      cur = addDays(cur, 1);
    }
    return buckets;
  }

  // Longer custom ranges: group by month
  const buckets: Omit<IncidentBucket, 'count'>[] = [];
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({ key, label: formatMonthLabel(`${key}-01`) });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

function countEventsInBucket(events: SafetyEvent[], bucketKey: string, filters: SIFilters): number {
  if (filters.dateRange === '24h') {
    const slotIndex = Number(bucketKey.replace('h-', ''));
    const { to: endIso } = resolveSIFilterInstantBounds(filters);
    const endMs = new Date(endIso).getTime();
    const slotEnd = endMs - (11 - slotIndex) * 2 * 60 * 60 * 1000;
    const slotStart = slotEnd - 2 * 60 * 60 * 1000;
    return events.filter((e) => {
      const t = new Date(e.startedAt).getTime();
      return t >= slotStart && t < slotEnd;
    }).length;
  }

  if (bucketKey.includes('-') && bucketKey.length === 7) {
    return events.filter((e) => e.startedAt.slice(0, 7) === bucketKey).length;
  }

  return events.filter((e) => e.startedAt.slice(0, 10) === bucketKey).length;
}

function buildIncidentChartData(events: SafetyEvent[], filters: SIFilters): IncidentBucket[] {
  const buckets = buildIncidentBuckets(filters);
  return buckets.map((b) => ({
    ...b,
    count: countEventsInBucket(events, b.key, filters),
  }));
}

function SafetyIncidentBarChart({
  buckets,
  periodLabel,
}: {
  buckets: IncidentBucket[];
  periodLabel: string;
}) {
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  const max = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-100">{total}</p>
          <p className="text-xs text-slate-500">Total observations · {periodLabel}</p>
        </div>
        <p className="text-[11px] text-slate-600">
          {buckets.length} {buckets.length === 1 ? 'bucket' : 'buckets'} in range
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800/60 bg-slate-950/30 px-3 py-4">
        <div className="relative h-32 min-w-0">
          <div
            className="pointer-events-none absolute inset-0 flex flex-col justify-between"
            aria-hidden
          >
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="border-t border-dashed border-slate-800/60" />
            ))}
          </div>
          <div className="relative flex h-full min-w-0 items-end gap-2 sm:gap-2.5">
            {buckets.map((b) => {
              const heightPct = (b.count / max) * 100;
              const barHeightPct = Math.max(heightPct, b.count > 0 ? 14 : 2);
              const barHeight = b.count > 0
                ? `max(1.5rem, calc(8rem * ${barHeightPct} / 100))`
                : '2px';
              return (
                <div
                  key={b.key}
                  className="flex h-full min-w-[2.75rem] flex-1 flex-col justify-end items-center sm:min-w-[3rem]"
                  title={`${b.subLabel ? `${b.subLabel}, ` : ''}${b.label}: ${b.count} observation${b.count === 1 ? '' : 's'}`}
                >
                  {b.count > 0 && (
                    <span className="mb-0.5 w-full shrink-0 text-center text-[10px] font-bold leading-none tabular-nums text-slate-200 sm:text-[11px]">
                      {b.count}
                    </span>
                  )}
                  <div
                    className="w-full overflow-hidden rounded-t-md bg-gradient-to-t from-sky-700 to-sky-400 shadow-sm shadow-sky-950/40 transition-all hover:from-sky-600 hover:to-sky-300"
                    style={{ height: barHeight }}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-2 flex min-w-0 gap-2 sm:gap-2.5">
          {buckets.map((b) => (
            <div
              key={b.key}
              className="flex min-w-[2.75rem] flex-1 flex-col items-center gap-0.5 text-center sm:min-w-[3rem]"
              title={b.subLabel ? `${b.subLabel}, ${b.label}` : b.label}
            >
              <span className="w-full truncate text-[9px] leading-tight text-slate-500 sm:text-[10px]">
                {b.label}
              </span>
              {b.subLabel && (
                <span className="w-full truncate text-[8px] leading-tight text-slate-600 sm:text-[9px]">
                  {b.subLabel}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CampusSafetyPage() {
  const [filters, setFilters] = useState<SIFilters>({ organizationId: '', siteId: '', dateRange: '7d' });
  const orgId = resolveOrganizationId(filters);
  const { data: zonesData } = useZones();
  const { data: camerasPayload } = useCameras();
  const { data: floorsData } = useQuery({
    queryKey: ['campus-safety-floors', orgId],
    queryFn: async () => (await fetch('/api/floors')).json(),
  });
  const { data: buildingsData } = useQuery({
    queryKey: ['campus-safety-buildings', orgId],
    queryFn: async () => (await fetch('/api/buildings')).json(),
  });
  const zones = Array.isArray(zonesData) ? (zonesData as { id: number; floorId?: number }[]) : [];
  const cameras =
    (camerasPayload as { cameras?: { id: number; zoneId?: number }[] })?.cameras ?? [];
  const floors = Array.isArray(floorsData) ? (floorsData as { id: number; buildingId: number }[]) : [];
  const buildings = Array.isArray(buildingsData) ? (buildingsData as { id: number; siteId: number }[]) : [];
  const zoneToSiteId = useMemo(() => {
    const m = new Map<number, number>();
    for (const z of zones) {
      if (!z.floorId) continue;
      const fl = floors.find((f) => f.id === z.floorId);
      if (!fl) continue;
      const b = buildings.find((bb) => bb.id === fl.buildingId);
      if (b) m.set(z.id, b.siteId);
    }
    return m;
  }, [zones, floors, buildings]);

  const matchesSiteFilter = useCallback(
    (event: SafetyEvent) => {
      if (!filters.siteId) return true;
      const sid = Number(filters.siteId);
      const cam = event.cameraId ? cameras.find((c) => c.id === event.cameraId) : undefined;
      const zid = event.zoneId ?? cam?.zoneId;
      const siteId = zid != null ? zoneToSiteId.get(zid) : undefined;
      return siteId === sid;
    },
    [filters.siteId, cameras, zoneToSiteId],
  );

  const [observationFilter, setObservationFilter] = useState<ObservationFilter>('priority');
  const [events, setEvents] = useState<SafetyEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const { to: summaryDate, from: periodStart } = resolveSIFilterDates(filters);
  const periodLabel = formatSIFilterPeriodLabel(filters);
  const compareLabel = scoreCompareLabel(filters.dateRange, periodStart, summaryDate);
  const scores = useSchoolOverallScore(orgId, summaryDate, filters.dateRange);
  const scoreCompare = useSchoolScoreCompare(orgId, filters);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const { from, to } = resolveSIFilterInstantBounds(filters);
      const q = new URLSearchParams({
        organizationId: String(orgId),
        from,
        to,
      });
      const res = await fetch(`/api/intelligence-events?${q}`);
      if (!res.ok) throw new Error(`Events API returned ${res.status}`);
      const data = await res.json();
      const allEvents: SafetyEvent[] = data.events ?? [];
      const safetyEvents = allEvents
        .filter((e) => CAMPUS_SAFETY_EVENT_TYPES.includes(e.eventType))
        .filter((e) => isInstantInSIFilterPeriod(e.startedAt, filters))
        .filter(matchesSiteFilter);
      setEvents(safetyEvents);
    } catch (e) {
      setEvents([]);
      setEventsError(e instanceof Error ? e.message : 'Failed to load events');
    } finally {
      setEventsLoading(false);
    }
  }, [filters, orgId, matchesSiteFilter]);

  useEffect(() => { void loadEvents(); }, [loadEvents]);

  const periodEvents = useMemo(
    () => events.filter((e) => isInstantInSIFilterPeriod(e.startedAt, filters)),
    [events, filters],
  );

  const criticalEvents = periodEvents.filter((e) => CAMPUS_SAFETY_CRITICAL_TYPES.includes(e.eventType));
  const highEvents = periodEvents.filter((e) => CAMPUS_SAFETY_HIGH_TYPES.includes(e.eventType));
  const priorityCount = periodEvents.filter(
    (e) => e.severity === 'Critical' || e.severity === 'High',
  ).length;

  const displayedObservations = useMemo(() => {
    const base =
      observationFilter === 'priority'
        ? periodEvents.filter((e) => e.severity === 'Critical' || e.severity === 'High')
        : periodEvents;
    return [...base].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
  }, [periodEvents, observationFilter]);

  const incidentChart = useMemo(
    () => buildIncidentChartData(periodEvents, filters),
    [periodEvents, filters],
  );

  const handleRefresh = useCallback(() => {
    void loadEvents();
    void scores.reload();
    void scoreCompare.reload();
  }, [loadEvents, scores.reload, scoreCompare.reload]);

  usePageHeaderRefresh(handleRefresh);

  return (
    <div className="space-y-6">
      <SchoolIntelligenceBreadcrumbs current="Campus Safety" />
      <SIFilterBar filters={filters} onChange={setFilters} />

      {eventsError && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          Failed to load safety events: {eventsError}
        </div>
      )}

      {(scores.error || scoreCompare.error) && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {scores.error && <p>Scores: {scores.error}</p>}
          {scoreCompare.error && <p>Score comparison: {scoreCompare.error}</p>}
        </div>
      )}

      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-slate-200">
            <BarChart3 className="h-4 w-4 text-sky-400" aria-hidden />
            Observation trend
          </CardTitle>
          <p className="text-xs font-normal text-slate-500">{periodLabel}</p>
        </CardHeader>
        <CardContent>
          <SafetyIncidentBarChart buckets={incidentChart} periodLabel={periodLabel} />
        </CardContent>
      </Card>

      {/* Observation summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500">Observations</p>
            <p className="text-2xl font-bold text-slate-200">{periodEvents.length}</p>
            <p className="mt-0.5 truncate text-[10px] text-slate-600">{periodLabel}</p>
          </CardContent>
        </Card>
        <Card className={`border ${criticalEvents.length > 0 ? 'border-red-900/50 bg-red-950/20' : 'border-slate-800 bg-slate-900/50'}`}>
          <CardContent className="p-3">
            <p className="text-xs text-slate-500">Critical observations</p>
            <p className={`text-2xl font-bold ${criticalEvents.length > 0 ? 'text-red-300' : 'text-slate-400'}`}>{criticalEvents.length}</p>
          </CardContent>
        </Card>
        <Card className={`border ${priorityCount > 0 ? 'border-orange-900/40 bg-orange-950/10' : 'border-slate-800 bg-slate-900/50'}`}>
          <CardContent className="p-3">
            <p className="text-xs text-slate-500">High priority</p>
            <p className={`text-2xl font-bold ${priorityCount > 0 ? 'text-orange-300' : 'text-slate-400'}`}>{priorityCount}</p>
          </CardContent>
        </Card>
        <Card className={`border ${highEvents.length > 0 ? 'border-orange-900/40 bg-orange-950/10' : 'border-slate-800 bg-slate-900/50'}`}>
          <CardContent className="p-3">
            <p className="text-xs text-slate-500">High severity</p>
            <p className={`text-2xl font-bold ${highEvents.length > 0 ? 'text-orange-300' : 'text-slate-400'}`}>{highEvents.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Event type coverage */}
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-300">
            Observation types
            <span className="ml-2 font-normal text-slate-500">· {periodLabel}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CAMPUS_SAFETY_OBSERVATION_TYPES.map((typeCfg) => {
              const count = periodEvents.filter((e) => e.eventType === typeCfg.type).length;
              const isCritical = typeCfg.isCritical ?? false;
              const isHigh = typeCfg.isHigh ?? false;
              return (
                <div
                  key={typeCfg.type}
                  className={`flex flex-col gap-1 rounded-md border p-2.5 text-xs ${
                    count > 0
                      ? isCritical
                        ? 'border-red-900/50 bg-red-950/20'
                        : isHigh
                          ? 'border-orange-900/40 bg-orange-950/10'
                          : 'border-amber-900/30 bg-amber-950/10'
                      : 'border-slate-800 bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {TYPE_GRID_ICONS[typeCfg.type] ?? (
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                      )}
                      <span className={count > 0 ? 'text-slate-200' : 'text-slate-500'}>
                        {typeCfg.label}
                      </span>
                    </span>
                    {count > 0 ? (
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${
                          isCritical
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {count}
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] text-slate-600">—</span>
                    )}
                  </div>
                  <p className="line-clamp-2 pl-5 text-[10px] leading-snug text-slate-500">
                    {typeCfg.description}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <SafetyEventFeed
          observations={displayedObservations}
          loading={eventsLoading}
          filter={observationFilter}
          onFilterChange={setObservationFilter}
          eventIcons={EVENT_ICONS}
          eventLabels={CAMPUS_SAFETY_TYPE_LABELS}
          periodLabel={periodLabel}
        />
        <CampusSafetyScorePanel
          overallScore={scores.data?.overallScore ?? null}
          moduleCompare={scoreCompare.data?.moduleDeltas}
          compareLabel={compareLabel}
          filters={filters}
          periodStart={periodStart}
          periodEnd={summaryDate}
          periodLabel={periodLabel}
          events={periodEvents}
          loading={scores.loading || scoreCompare.loading}
        />
      </div>

    </div>
  );
}
