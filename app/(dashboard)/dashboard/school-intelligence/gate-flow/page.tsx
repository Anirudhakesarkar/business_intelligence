'use client';

import { useEffect, useState } from 'react';
import { DoorOpen, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SchoolDailyModuleView } from '@/components/school-intelligence/SchoolDailyModuleView';

type TimeWindow = { id: number; name: string; windowType: string; startTime: string; endTime: string; isActive: boolean };
type GateEvent  = { id: number; eventType: string; severity: string; detectedAt: string; description?: string; status: string };

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const WINDOW_TYPE_LABELS: Record<string, string> = {
  arrival:     'Arrival',
  dispersal:   'Dispersal',
  break:       'Break',
  lunch:       'Lunch',
  assembly:    'Assembly',
  maintenance: 'Maintenance',
};

const WINDOW_TYPE_COLORS: Record<string, { bg: string; badge: string; dot: string }> = {
  arrival:   { bg: 'border-sky-800/40 bg-sky-950/10',    badge: 'bg-sky-500/10 text-sky-400 border-sky-500/30',     dot: 'bg-sky-400' },
  dispersal: { bg: 'border-purple-800/40 bg-purple-950/10', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30', dot: 'bg-purple-400' },
  break:     { bg: 'border-amber-800/40 bg-amber-950/10', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  lunch:     { bg: 'border-green-800/40 bg-green-950/10', badge: 'bg-green-500/10 text-green-400 border-green-500/30', dot: 'bg-green-400' },
};

function GateFlowPanel({ date, orgId }: { date: string; orgId: number }) {
  const [windows, setWindows] = useState<TimeWindow[]>([]);
  const [events, setEvents]   = useState<GateEvent[]>([]);
  const [processMetrics, setProcessMetrics] = useState<Record<string, number | string | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void Promise.all([
      fetch(`/api/daily-summaries/process?organizationId=${orgId}&date=${encodeURIComponent(date)}`)
        .then((r) => r.json())
        .then((j) => (j.headlineMetrics && typeof j.headlineMetrics === 'object' ? j.headlineMetrics : {}))
        .catch(() => ({})),
      fetch(`/api/school-time-windows?organizationId=${orgId}`).then((r) => r.json()),
      fetch(`/api/intelligence-events?organizationId=${orgId}&eventType=GateCongestion&from=${date}&to=${date}`)
        .then((r) => r.json()).then((j) => j.events ?? []).catch(() => []),
      fetch(`/api/intelligence-events?organizationId=${orgId}&eventType=ParentExperience&from=${date}&to=${date}`)
        .then((r) => r.json()).then((j) => j.events ?? []).catch(() => []),
    ]).then(([proc, wins, gateEvts, parentEvts]) => {
      setProcessMetrics(proc as Record<string, number | string | null>);
      setWindows((Array.isArray(wins) ? wins : []).filter((w: TimeWindow) => w.isActive));
      setEvents([...(Array.isArray(gateEvts) ? gateEvts : []), ...(Array.isArray(parentEvts) ? parentEvts : [])]);
    }).finally(() => setLoading(false));
  }, [date, orgId]);

  const isToday = date === new Date().toISOString().slice(0, 10);
  const now     = nowHHMM();

  const enrichedWindows = windows
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((w) => {
      const isActive  = isToday && now >= w.startTime && now < w.endTime;
      const isDone    = !isToday || now >= w.endTime;
      const isUpcoming = isToday && now < w.startTime;
      const duration  = (() => {
        const [sh, sm] = w.startTime.split(':').map(Number);
        const [eh, em] = w.endTime.split(':').map(Number);
        return (eh * 60 + em) - (sh * 60 + sm);
      })();
      return { window: w, isActive, isDone, isUpcoming, duration };
    });

  const congestCount = events.filter((e) => e.eventType === 'GateCongestion').length;
  const activeWindow = enrichedWindows.find((w) => w.isActive);
  const dispersalMin = Number(processMetrics.dispersal_congestion_min ?? 0);
  const arrivalMin = Number(processMetrics.congestion_minutes ?? 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Card className="border-purple-900/40 bg-purple-950/10">
          <CardContent className="p-3">
            <p className="text-xs text-purple-300/80">Dispersal congestion (process_daily)</p>
            <p className="text-2xl font-bold text-purple-200">{dispersalMin} min</p>
          </CardContent>
        </Card>
        <Card className="border-sky-900/40 bg-sky-950/10">
          <CardContent className="p-3">
            <p className="text-xs text-sky-300/80">Arrival congestion (process_daily)</p>
            <p className="text-2xl font-bold text-sky-200">{arrivalMin} min</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 border-amber-900/40 bg-amber-950/10 sm:col-span-1">
          <CardContent className="p-3">
            <p className="text-xs text-amber-300/80">GateCongestion events (rule engine)</p>
            <p className="text-2xl font-bold text-amber-200">{congestCount}</p>
          </CardContent>
        </Card>
      </div>
      {/* Current window highlight */}
      {isToday && activeWindow && (
        <div className={`flex items-center gap-3 rounded-lg border p-4 ${WINDOW_TYPE_COLORS[activeWindow.window.windowType]?.bg ?? 'border-slate-800 bg-slate-900'}`}>
          <div className={`h-3 w-3 shrink-0 animate-pulse rounded-full ${WINDOW_TYPE_COLORS[activeWindow.window.windowType]?.dot ?? 'bg-sky-400'}`} />
          <div>
            <p className="text-sm font-semibold text-slate-100">
              {WINDOW_TYPE_LABELS[activeWindow.window.windowType] ?? activeWindow.window.windowType} window active now
            </p>
            <p className="text-xs text-slate-400">
              {activeWindow.window.name} · {activeWindow.window.startTime} – {activeWindow.window.endTime}
            </p>
          </div>
          {congestCount > 0 && (
            <div className="ml-auto flex items-center gap-1.5 rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-1.5 text-xs text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              {congestCount} congestion alert{congestCount > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Time-window timeline */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm text-slate-300">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-sky-400" />
              Gate & Campus Windows
            </span>
            <span className="text-xs text-slate-500">{windows.length} window{windows.length !== 1 ? 's' : ''}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : enrichedWindows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-700 py-8 text-center">
              <DoorOpen className="mx-auto mb-2 h-8 w-8 text-slate-700" />
              <p className="text-sm text-slate-500">No time windows defined.</p>
              <p className="mt-1 text-xs text-slate-600">Add arrival/dispersal windows in School Management → Settings.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {enrichedWindows.map(({ window: w, isActive, isDone, duration }) => {
                const colors = WINDOW_TYPE_COLORS[w.windowType] ?? { bg: 'border-slate-700', badge: 'bg-slate-700 text-slate-400 border-slate-600', dot: 'bg-slate-500' };
                return (
                  <div key={w.id} className={`flex items-center gap-4 rounded-lg border p-3 ${isActive ? colors.bg : 'border-slate-800 bg-slate-800/20'}`}>
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isActive ? colors.dot + ' bg-opacity-20' : 'bg-slate-800'}`}>
                      <DoorOpen className={`h-4 w-4 ${isActive ? 'text-slate-200' : 'text-slate-600'}`} />
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${isActive ? 'text-slate-100' : isDone ? 'text-slate-500' : 'text-slate-300'}`}>
                        {w.name}
                      </p>
                      <p className="text-xs text-slate-500">{w.startTime} – {w.endTime} · {duration} min</p>
                    </div>
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${colors.badge}`}>
                      {WINDOW_TYPE_LABELS[w.windowType] ?? w.windowType}
                    </span>
                    {isActive && (
                      <span className="shrink-0 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                        Live
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gate congestion events */}
      {events.length > 0 ? (
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Gate & Congestion Alerts
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">{events.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {events.slice(0, 10).map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 rounded-lg border border-amber-900/30 bg-amber-950/5 p-3">
                  <p className="text-sm text-slate-300">{e.description ?? e.eventType}</p>
                  <span className="shrink-0 text-xs text-slate-500">
                    {new Date(e.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        !loading && (
          <div className="flex items-center gap-2 rounded-lg border border-green-800/30 bg-green-950/10 px-4 py-3 text-sm text-green-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> No congestion alerts for this date.
          </div>
        )
      )}
    </div>
  );
}

export default function Page() {
  return (
    <SchoolDailyModuleView
      module="process"
      title="Gate Arrival & Dispersal"
      description="Arrival and dispersal windows — live gate flow, congestion alerts, and campus time windows."
      icon={<DoorOpen className="h-6 w-6" />}
      secondaryModule="parent"
      kpiKeys={[
        { key: 'dispersal_congestion_min', label: 'Dispersal congestion (min)' },
        { key: 'congestion_minutes', label: 'Arrival congestion (min)' },
      ]}
      extra={(date, orgId) => <GateFlowPanel date={date} orgId={orgId} />}
    />
  );
}
