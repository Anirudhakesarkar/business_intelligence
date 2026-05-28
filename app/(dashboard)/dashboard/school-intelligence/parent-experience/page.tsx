'use client';

import { useEffect, useState } from 'react';
import { Heart, CheckCircle2, AlertTriangle, Clock, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SchoolDailyModuleView } from '@/components/school-intelligence/SchoolDailyModuleView';

type TimeWindow  = { id: number; name: string; windowType: string; startTime: string; endTime: string; isActive: boolean };
type GateEvent   = { id: number; eventType: string; severity: string; detectedAt: string; description?: string; status: string };

const PARENT_EVENT_TYPES = ['GateCongestion', 'ParentExperience'];

type CongestionLevel = 'clear' | 'moderate' | 'high' | 'critical';

function congestionLevel(count: number): CongestionLevel {
  if (count === 0)  return 'clear';
  if (count <= 2)   return 'moderate';
  if (count <= 5)   return 'high';
  return 'critical';
}

const CONGESTION_STYLE: Record<CongestionLevel, { label: string; bar: string; text: string; bg: string; border: string }> = {
  clear:    { label: 'Clear',    bar: 'bg-green-500',  text: 'text-green-300',  bg: 'bg-green-950/10',  border: 'border-green-800/30' },
  moderate: { label: 'Moderate', bar: 'bg-amber-500',  text: 'text-amber-300',  bg: 'bg-amber-950/10',  border: 'border-amber-800/30' },
  high:     { label: 'High',     bar: 'bg-orange-500', text: 'text-orange-300', bg: 'bg-orange-950/10', border: 'border-orange-800/30' },
  critical: { label: 'Critical', bar: 'bg-red-500',    text: 'text-red-300',    bg: 'bg-red-950/10',    border: 'border-red-800/30' },
};

function ParentExperiencePanel({ date, orgId }: { date: string; orgId: number }) {
  const [windows, setWindows] = useState<TimeWindow[]>([]);
  const [events, setEvents]   = useState<GateEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fetches = [
      fetch(`/api/school-time-windows?organizationId=${orgId}`).then((r) => r.json()),
      ...PARENT_EVENT_TYPES.map((et) =>
        fetch(`/api/intelligence-events?organizationId=${orgId}&eventType=${et}&from=${date}&to=${date}`)
          .then((r) => r.json()).then((j) => j.events ?? []).catch(() => [])
      ),
    ];
    void Promise.all(fetches).then(([wins, ...eventArrays]) => {
      const gateWindows = (Array.isArray(wins) ? wins : []).filter((w: TimeWindow) =>
        w.isActive && ['arrival', 'dispersal'].includes(w.windowType)
      );
      setWindows(gateWindows);
      const allEvents = eventArrays.flat() as GateEvent[];
      setEvents(allEvents);
    }).finally(() => setLoading(false));
  }, [date, orgId]);

  // Per-window congestion analysis
  type WindowAnalysis = {
    window: TimeWindow;
    eventsInWindow: GateEvent[];
    level: CongestionLevel;
  };

  const windowAnalysis: WindowAnalysis[] = windows
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((w) => {
      const eventsInWindow = events.filter((e) => {
        const t = new Date(e.detectedAt).toTimeString().slice(0, 5);
        return t >= w.startTime && t < w.endTime;
      });
      return {
        window: w,
        eventsInWindow,
        level: congestionLevel(eventsInWindow.length),
      };
    });

  const arrivalWindows   = windowAnalysis.filter((wa) => wa.window.windowType === 'arrival');
  const dispersalWindows = windowAnalysis.filter((wa) => wa.window.windowType === 'dispersal');
  const worstLevel       = (['critical', 'high', 'moderate', 'clear'] as CongestionLevel[])
    .find((l) => windowAnalysis.some((wa) => wa.level === l)) ?? 'clear';
  const worstStyle       = CONGESTION_STYLE[worstLevel];

  return (
    <div className="space-y-5">
      {/* Headline experience indicator */}
      <div className={`flex items-center gap-4 rounded-lg border p-4 ${worstStyle.border} ${worstStyle.bg}`}>
        <div className={`text-3xl font-bold ${worstStyle.text}`}>{worstStyle.label}</div>
        <div>
          <p className="text-sm text-slate-300">Overall gate experience — {date}</p>
          <p className="text-xs text-slate-500">
            {events.length} congestion event{events.length !== 1 ? 's' : ''} across {windows.length} gate window{windows.length !== 1 ? 's' : ''}
          </p>
        </div>
        {worstLevel === 'clear'
          ? <CheckCircle2 className="ml-auto h-6 w-6 text-green-400" />
          : <AlertTriangle className="ml-auto h-6 w-6 text-amber-400" />}
      </div>

      {/* Arrival vs dispersal breakdown */}
      {(arrivalWindows.length > 0 || dispersalWindows.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: 'Arrival', icon: <TrendingUp className="h-4 w-4 text-sky-400" />, items: arrivalWindows },
            { label: 'Dispersal', icon: <TrendingDown className="h-4 w-4 text-purple-400" />, items: dispersalWindows },
          ].map(({ label, icon, items }) => (
            items.length > 0 && (
              <Card key={label} className="border-slate-800 bg-slate-900">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
                    {icon} {label} Windows
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.map(({ window: w, eventsInWindow, level }) => {
                    const style = CONGESTION_STYLE[level];
                    const fillPct = Math.min(100, (eventsInWindow.length / 6) * 100);
                    return (
                      <div key={w.id}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">
                            <Clock className="mr-1 inline h-3 w-3" />{w.startTime}–{w.endTime}
                          </span>
                          <span className={`font-medium ${style.text}`}>{style.label}</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-slate-700">
                          <div className={`h-2 rounded-full ${style.bar} transition-all`} style={{ width: `${fillPct || (eventsInWindow.length === 0 ? 0 : 10)}%` }} />
                        </div>
                        <p className="mt-0.5 text-xs text-slate-600">
                          {eventsInWindow.length} event{eventsInWindow.length !== 1 ? 's' : ''} · {w.name}
                        </p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )
          ))}
        </div>
      )}

      {/* Congestion event list */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm text-slate-300">
            <span className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-400" />
              Congestion & Experience Events
            </span>
            {events.length > 0 && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">{events.length}</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : events.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-green-800/30 bg-green-950/10 px-4 py-3 text-sm text-green-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              No congestion events — smooth parent experience for this date.
            </div>
          ) : (
            <ul className="space-y-2">
              {events.slice(0, 10).map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-800/30 p-3">
                  <div>
                    <p className="text-sm text-slate-300">{e.description ?? e.eventType}</p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {new Date(e.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {e.status}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-xs capitalize ${
                    e.severity === 'critical' ? 'border-red-500/40 bg-red-500/10 text-red-400' :
                    e.severity === 'high'     ? 'border-orange-500/40 bg-orange-500/10 text-orange-400' :
                                               'border-amber-500/40 bg-amber-500/10 text-amber-400'
                  }`}>{e.severity}</span>
                </li>
              ))}
              {events.length > 10 && (
                <p className="pt-1 text-xs text-slate-500">{events.length - 10} more in Events Inbox.</p>
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <SchoolDailyModuleView
      module="parent"
      title="Parent Experience"
      description="Gate flow quality — arrival congestion, dispersal windows, and parent wait times."
      icon={<Heart className="h-6 w-6" />}
      kpiKeys={[{ key: 'dispersal_congestion_min', label: 'Dispersal congestion (min)' }]}
      extra={(date, orgId) => <ParentExperiencePanel date={date} orgId={orgId} />}
    />
  );
}
