'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { SchoolIntelligenceBreadcrumbs } from '@/components/school-intelligence/SchoolIntelligenceBreadcrumbs';
import { usePageHeaderRefresh } from '@/components/layout/page-header-context';
import {
  useEvaluateRules,
  useIntelligenceEvents,
  useSeedRuleEngine,
} from '@/components/school-intelligence/useSchoolRuleEngine';
import { useCameras, useZones } from '@/components/school-management/useSchoolFoundation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck, Play, AlertTriangle, AlertCircle,
  CheckCircle2, Clock, Filter, ChevronRight, Inbox,
} from 'lucide-react';

type IntelligenceEvent = {
  id: number;
  eventType: string;
  module: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'Acknowledged' | 'Assigned' | 'Resolved';
  startedAt: string;
  evidence: { summary: string; metrics?: Record<string, unknown> };
  cameraId?: number;
  zoneId?: number;
  roomId?: number;
  confidence?: number;
  assignedTo?: string;
};

const EVENT_TYPE_OPTIONS = [
  'TeacherSupervisionGap',
  'GateCongestion',
  'DispersalDelay',
  'CriticalCameraOffline',
  'RunningDetected',
  'FallDetected',
] as const;

const SEVERITY_CONFIG = {
  Low: { cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: AlertCircle, border: 'border-l-blue-500' },
  Medium: { cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: AlertTriangle, border: 'border-l-amber-500' },
  High: { cls: 'bg-orange-500/20 text-orange-300 border-orange-500/30', icon: AlertTriangle, border: 'border-l-orange-500' },
  Critical: { cls: 'bg-red-500/20 text-red-400 border-red-500/30', icon: AlertCircle, border: 'border-l-red-500' },
};

const STATUS_CONFIG = {
  Open: { cls: 'bg-red-500/10 text-red-400 border-red-500/30', label: 'Open' },
  Acknowledged: { cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30', label: 'Ack\'d' },
  Assigned: { cls: 'bg-blue-500/10 text-blue-400 border-blue-500/30', label: 'Assigned' },
  Resolved: { cls: 'bg-green-500/10 text-green-400 border-green-500/30', label: 'Resolved' },
};

const MODULE_COLORS: Record<string, string> = {
  Core: 'text-slate-400',
  TeacherProductivity: 'text-blue-400',
  StudentOccupancy: 'text-sky-400',
  AcademicOperations: 'text-indigo-400',
  StaffDeployment: 'text-purple-400',
  SpaceUtilization: 'text-teal-400',
  Discipline: 'text-red-400',
  ParentExperience: 'text-green-400',
  Compliance: 'text-amber-400',
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function dayEndIso(d: string) {
  return `${d}T23:59:59.999Z`;
}

function SeverityBadge({ severity }: { severity: string }) {
  const cfg = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.Low;
  return <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs font-medium ${cfg.cls}`}>{severity}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.Open;
  return <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>;
}

type ZoneRow = { id: number; name: string; floorId?: number };
type FloorRow = { id: number; buildingId: number };
type BuildingRow = { id: number; siteId: number };

export default function EventsInboxPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('Open');
  const [severityFilter, setSeverityFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);

  const { data: zonesData } = useZones();
  const { data: camerasPayload } = useCameras();
  const zones: ZoneRow[] = Array.isArray(zonesData) ? (zonesData as ZoneRow[]) : [];
  const cameras: { id: number; zoneId?: number }[] =
    (camerasPayload as { cameras?: { id: number; zoneId?: number }[] })?.cameras ?? [];

  const { data: floorsData } = useQuery({
    queryKey: ['intel-floors', 1],
    queryFn: async () => (await fetch('/api/floors')).json(),
  });
  const { data: buildingsData } = useQuery({
    queryKey: ['intel-buildings', 1],
    queryFn: async () => (await fetch('/api/buildings')).json(),
  });
  const { data: sitesData } = useQuery({
    queryKey: ['intel-sites', 1],
    queryFn: async () => (await fetch('/api/sites?organizationId=1')).json(),
  });

  const floors: FloorRow[] = Array.isArray(floorsData) ? floorsData : [];
  const buildings: BuildingRow[] = Array.isArray(buildingsData) ? buildingsData : [];

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

  const apiFilters = useMemo(() => {
    const f: { status?: string; from?: string; to?: string; eventType?: string; zoneId?: number } = {};
    if (statusFilter !== 'All') f.status = statusFilter;
    if (fromDate) f.from = `${fromDate}T00:00:00.000Z`;
    if (toDate) f.to = dayEndIso(toDate);
    if (eventTypeFilter) f.eventType = eventTypeFilter;
    if (zoneFilter) f.zoneId = Number(zoneFilter);
    return f;
  }, [statusFilter, fromDate, toDate, eventTypeFilter, zoneFilter]);

  const { data, isLoading, refetch } = useIntelligenceEvents(apiFilters);
  const seed = useSeedRuleEngine();
  const evaluate = useEvaluateRules();

  const allEvents: IntelligenceEvent[] = (data as { events?: IntelligenceEvent[] })?.events ?? [];

  const events = useMemo(() => {
    return allEvents.filter((e) => {
      if (severityFilter && e.severity !== severityFilter) return false;
      if (moduleFilter && e.module !== moduleFilter) return false;
      if (siteFilter) {
        const sid = Number(siteFilter);
        const cam = e.cameraId ? cameras.find((c) => c.id === e.cameraId) : undefined;
        const zid = e.zoneId ?? cam?.zoneId;
        const siteId = zid != null ? zoneToSiteId.get(zid) : undefined;
        if (siteId !== sid) return false;
      }
      return true;
    });
  }, [allEvents, severityFilter, moduleFilter, siteFilter, zoneToSiteId, cameras]);

  const modules = useMemo(() => [...new Set(allEvents.map((e) => e.module))], [allEvents]);

  const stats = useMemo(
    () => ({
      open: allEvents.filter((e) => e.status === 'Open').length,
      critical: allEvents.filter((e) => e.severity === 'Critical').length,
      ackd: allEvents.filter((e) => e.status === 'Acknowledged').length,
      resolved: allEvents.filter((e) => e.status === 'Resolved').length,
    }),
    [allEvents],
  );

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const selectAllOpen = useCallback(() => {
    const ids = events.filter((e) => e.status === 'Open').map((e) => e.id);
    setSelected(new Set(ids));
  }, [events]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  async function quickAction(id: number, action: 'ack' | 'resolve') {
    await fetch(`/api/intelligence-events/${id}/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    qc.invalidateQueries({ queryKey: ['intel-events'] });
    setSelected((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  }

  async function bulkAck() {
    setBulkPending(true);
    try {
      for (const id of selected) {
        const ev = events.find((e) => e.id === id);
        if (ev?.status === 'Open') {
          await fetch(`/api/intelligence-events/${id}/ack`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
          });
        }
      }
      qc.invalidateQueries({ queryKey: ['intel-events'] });
      clearSelection();
    } finally {
      setBulkPending(false);
    }
  }

  const isHealthyDay =
    allEvents.length === 0 &&
    !isLoading &&
    fromDate === todayIso() &&
    (toDate === '' || toDate === fromDate) &&
    eventTypeFilter === '';

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  usePageHeaderRefresh(handleRefresh);

  return (
    <div className="space-y-6">
      <SchoolIntelligenceBreadcrumbs current="Events inbox" />

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => seed.mutate()} disabled={seed.isPending}>
          <ShieldCheck className="mr-1 h-3 w-3" />
          {seed.isPending ? 'Seeding…' : 'Seed rules + signals'}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => evaluate.mutate()} disabled={evaluate.isPending}>
          <Play className="mr-1 h-3 w-3" />
          {evaluate.isPending ? 'Evaluating…' : 'Evaluate rules'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-red-900/40 bg-red-950/20">
          <CardContent className="p-3">
            <p className="text-xs text-red-500">Open</p>
            <p className="text-2xl font-bold text-red-300">{stats.open}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-900/40 bg-orange-950/20">
          <CardContent className="p-3">
            <p className="text-xs text-orange-500">Critical</p>
            <p className="text-2xl font-bold text-orange-300">{stats.critical}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-900/40 bg-amber-950/20">
          <CardContent className="p-3">
            <p className="text-xs text-amber-500">Acknowledged</p>
            <p className="text-2xl font-bold text-amber-300">{stats.ackd}</p>
          </CardContent>
        </Card>
        <Card className="border-green-900/40 bg-green-950/20">
          <CardContent className="p-3">
            <p className="text-xs text-green-500">Resolved</p>
            <p className="text-2xl font-bold text-green-300">{stats.resolved}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {['All', 'Open', 'Acknowledged', 'Assigned', 'Resolved'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                statusFilter === s
                  ? 'border-sky-500 bg-sky-500/20 text-sky-300'
                  : 'border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <Filter className="h-3.5 w-3.5 text-slate-500 self-center" />
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            From
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            To
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Event type
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
            >
              <option value="">All types</option>
              {EVENT_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
          >
            <option value="">All severities</option>
            {['Low', 'Medium', 'High', 'Critical'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
          >
            <option value="">All modules</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
          >
            <option value="">All zones</option>
            {zones.map((z) => (
              <option key={z.id} value={String(z.id)}>
                {z.name}
              </option>
            ))}
          </select>
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
          >
            <option value="">All sites</option>
            {(Array.isArray(sitesData) ? sitesData : []).map((s: { id: number; name: string }) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded border border-sky-800/50 bg-sky-950/20 px-3 py-2 text-xs text-slate-300">
            <span>{selected.size} selected</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={bulkAck} disabled={bulkPending}>
              {bulkPending ? 'Acking…' : 'Bulk acknowledge (open only)'}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={selectAllOpen}>
              Select all open in view
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearSelection}>
              Clear
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : isHealthyDay ? (
        <div className="rounded-lg border border-dashed border-emerald-800/50 bg-emerald-950/10 p-8 text-center">
          <Inbox className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
          <p className="text-sm font-medium text-emerald-300">Healthy day — no intelligence events for today.</p>
          <p className="mt-1 text-xs text-slate-500">Widen the date range or seed demo data to see sample events.</p>
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center">
          <Inbox className="mx-auto mb-2 h-8 w-8 text-slate-600" />
          <p className="text-sm text-slate-500">
            {allEvents.length === 0
              ? 'No events yet. Seed rules + signals, then evaluate.'
              : 'No events match the current filters.'}
          </p>
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-left text-xs text-slate-500">
              <tr>
                <th className="w-10 px-2 py-2" />
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Assignee</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {events.map((e) => {
                const sevCfg = SEVERITY_CONFIG[e.severity] ?? SEVERITY_CONFIG.Low;
                const SevIcon = sevCfg.icon;
                const isActioning = false;
                const loc =
                  [e.zoneId ? `Zone #${e.zoneId}` : null, e.roomId ? `Room #${e.roomId}` : null, e.cameraId ? `Cam #${e.cameraId}` : null]
                    .filter(Boolean)
                    .join(' · ') || '—';
                return (
                  <tr key={e.id} className="hover:bg-slate-800/30">
                    <td className="px-2 py-2">
                      {e.status === 'Open' && (
                        <input
                          type="checkbox"
                          checked={selected.has(e.id)}
                          onChange={() => toggleSelect(e.id)}
                          className="accent-sky-500"
                        />
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(e.startedAt).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/dashboard/school-intelligence/events/${e.id}`} className="font-medium text-sky-400 hover:underline">
                        {e.eventType}
                      </Link>
                      <p className="truncate text-xs text-slate-500">{e.evidence?.summary}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        <SevIcon className={`h-3.5 w-3.5 ${sevCfg.cls.split(' ')[1]}`} />
                        <SeverityBadge severity={e.severity} />
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-xs text-slate-400">{loc}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-400">{e.assignedTo ?? '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {e.status === 'Open' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            disabled={isActioning}
                            onClick={() => quickAction(e.id, 'ack')}
                          >
                            Ack
                          </Button>
                        )}
                        {(e.status === 'Open' || e.status === 'Acknowledged' || e.status === 'Assigned') && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs text-green-400"
                            disabled={isActioning}
                            onClick={() => quickAction(e.id, 'resolve')}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Resolve
                          </Button>
                        )}
                        <Link href={`/dashboard/school-intelligence/events/${e.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                            <ChevronRight className="h-4 w-4 text-slate-500" />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
