'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar, ShieldAlert, Camera, Wifi, WifiOff, AlertTriangle, CheckCircle2, Flame, Activity, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SIModuleHeader } from '@/components/school-intelligence/SIModuleHeader';
import { useSchoolModuleScore } from '@/components/school-intelligence/useSchoolModuleScore';
import { todayIso } from '@/components/school-intelligence/useSchoolDailySummaries';

const ORG_ID = 1;

// Safety-critical event types
const SAFETY_EVENT_TYPES = [
  'FallDetected', 'FireSmokeDetected', 'CriticalCameraOffline', 'EmergencyExitCrowding',
  'FireExitObstruction', 'RestrictedZoneEntry', 'ServerRoomEntry', 'UnsafeClimbing',
  'RunningDetected', 'Loitering', 'VehicleStudentOverlap',
];

const CRITICAL_EVENT_TYPES = ['FallDetected', 'FireSmokeDetected', 'FireExitObstruction', 'EmergencyExitCrowding'];
const HIGH_EVENT_TYPES = ['CriticalCameraOffline', 'RestrictedZoneEntry', 'ServerRoomEntry', 'VehicleStudentOverlap'];

type SafetyEvent = {
  id: number;
  eventType: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'Acknowledged' | 'Assigned' | 'Resolved';
  startedAt: string;
  evidence: { summary: string };
  cameraId?: number;
};

type CameraHealthEntry = {
  cameraId: number;
  currentStatus: string;
  consecutiveOfflineMinutes: number;
};

const SEVERITY_COLORS: Record<string, string> = {
  Critical: 'text-red-400 bg-red-500/10 border-red-500/30',
  High: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  Low: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
};

const SEVERITY_LEFT: Record<string, string> = {
  Critical: 'border-l-red-500',
  High: 'border-l-orange-500',
  Medium: 'border-l-amber-500',
  Low: 'border-l-blue-400',
};

const EVENT_ICONS: Record<string, React.ReactNode> = {
  FallDetected: <AlertTriangle className="h-4 w-4 text-red-400" />,
  FireSmokeDetected: <Flame className="h-4 w-4 text-red-500" />,
  FireExitObstruction: <Flame className="h-4 w-4 text-orange-400" />,
  EmergencyExitCrowding: <AlertTriangle className="h-4 w-4 text-red-400" />,
  CriticalCameraOffline: <WifiOff className="h-4 w-4 text-amber-400" />,
  RestrictedZoneEntry: <ShieldAlert className="h-4 w-4 text-orange-400" />,
};

function ScoreGauge({ label, score, weight, loading }: { label: string; score: number | null; weight: number; loading: boolean }) {
  const pct = score ?? 0;
  const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  const textColor = pct >= 80 ? 'text-green-300' : pct >= 60 ? 'text-amber-300' : 'text-red-300';
  return (
    <Card className="border-slate-800 bg-slate-900/60">
      <CardContent className="p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`text-3xl font-bold ${loading ? 'text-slate-600' : textColor}`}>
              {loading ? '…' : score ?? '—'}
            </p>
            <p className="text-xs text-slate-600">weight {Math.round(weight * 100)}%</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">/ 100</p>
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-slate-800">
          <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function CampusSafetyPage() {
  const [date, setDate] = useState(todayIso);
  const [statusFilter, setStatusFilter] = useState<'Open' | 'All'>('Open');
  const [events, setEvents] = useState<SafetyEvent[]>([]);
  const [cameraHealth, setCameraHealth] = useState<CameraHealthEntry[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(true);

  const safetyScore = useSchoolModuleScore('safety', ORG_ID, date);
  const securityScore = useSchoolModuleScore('security', ORG_ID, date);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const q = new URLSearchParams({ organizationId: String(ORG_ID) });
      if (statusFilter !== 'All') q.set('status', statusFilter);
      const res = await fetch(`/api/intelligence-events?${q}`);
      const data = await res.json();
      const allEvents: SafetyEvent[] = data.events ?? [];
      // Filter to safety-relevant event types
      setEvents(allEvents.filter((e) => SAFETY_EVENT_TYPES.includes(e.eventType)));
    } finally {
      setEventsLoading(false);
    }
  }, [statusFilter]);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch(`/api/camera-health?organizationId=${ORG_ID}`);
      const grid = (await res.json()) as Array<{
        camera: { id: number };
        freshness: { stale: boolean };
        latestHealth?: { healthStatus: string };
      }>;
      setCameraHealth(
        (Array.isArray(grid) ? grid : []).map((row) => {
          const ev = row.latestHealth?.healthStatus;
          let currentStatus = 'Online';
          if (ev === 'Tampered') currentStatus = 'Tampered';
          else if (ev === 'Unstable') currentStatus = 'Unstable';
          else if (ev === 'Maintenance') currentStatus = 'Maintenance';
          else if (row.freshness.stale || ev === 'Offline') currentStatus = 'Offline';
          return {
            cameraId: row.camera.id,
            currentStatus,
            consecutiveOfflineMinutes: 0,
          };
        }),
      );
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => { loadHealth(); }, [loadHealth]);

  const offlineCameras = cameraHealth.filter((c) => c.currentStatus === 'Offline' || c.currentStatus === 'Tampered');
  const onlineCameras = cameraHealth.filter((c) => c.currentStatus === 'Online');
  const criticalEvents = events.filter((e) => CRITICAL_EVENT_TYPES.includes(e.eventType));
  const highEvents = events.filter((e) => HIGH_EVENT_TYPES.includes(e.eventType));
  const openCount = events.filter((e) => e.status === 'Open').length;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/school-intelligence" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-sky-400">
        <ArrowLeft className="h-4 w-4" /> Back to School Intelligence
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SIModuleHeader
          title="Campus Safety & Security"
          description="Safety incidents, camera health, restricted zone activity, and emergency protocol coverage."
          icon={<ShieldAlert className="h-6 w-6" />}
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <Calendar className="h-4 w-4" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
            />
          </label>
          <Button size="sm" variant="outline" onClick={() => { loadEvents(); loadHealth(); safetyScore.reload(); securityScore.reload(); }}>
            <RefreshCw className="mr-1 h-3 w-3" /> Refresh
          </Button>
        </div>
      </div>

      {/* Score gauges */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ScoreGauge label="Safety Score" score={safetyScore.score} weight={0.2} loading={safetyScore.loading} />
        <ScoreGauge label="Security Score" score={securityScore.score} weight={0.1} loading={securityScore.loading} />
      </div>

      {/* Camera health summary */}
      <Card className={`border ${offlineCameras.length > 0 ? 'border-red-900/50 bg-red-950/10' : 'border-green-900/40 bg-green-950/10'}`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-slate-200">
            <Camera className="h-4 w-4" /> Camera Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          {healthLoading ? (
            <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
          ) : cameraHealth.length === 0 ? (
            <p className="text-sm text-slate-500">No camera health data. Seed AI signals to populate.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border border-green-900/40 bg-green-950/20 p-3 text-center">
                  <Wifi className="mx-auto mb-1 h-4 w-4 text-green-400" />
                  <p className="text-xl font-bold text-green-300">{onlineCameras.length}</p>
                  <p className="text-xs text-green-500">Online</p>
                </div>
                <div className="rounded-md border border-red-900/40 bg-red-950/20 p-3 text-center">
                  <WifiOff className="mx-auto mb-1 h-4 w-4 text-red-400" />
                  <p className="text-xl font-bold text-red-300">{offlineCameras.length}</p>
                  <p className="text-xs text-red-500">Offline/Tampered</p>
                </div>
                <div className="rounded-md border border-slate-700 bg-slate-800/50 p-3 text-center">
                  <Activity className="mx-auto mb-1 h-4 w-4 text-slate-400" />
                  <p className="text-xl font-bold text-slate-200">{cameraHealth.length}</p>
                  <p className="text-xs text-slate-500">Total</p>
                </div>
              </div>

              {offlineCameras.length > 0 && (
                <div className="rounded-md border border-red-900/40 bg-red-950/10 p-3">
                  <p className="mb-2 text-xs font-semibold text-red-400">⚠ Offline / Tampered Cameras</p>
                  <ul className="space-y-1">
                    {offlineCameras.map((c) => (
                      <li key={c.cameraId} className="flex items-center justify-between text-xs">
                        <span className="text-slate-300">Camera #{c.cameraId}</span>
                        <span className="text-red-400">
                          {c.currentStatus}
                          {c.consecutiveOfflineMinutes > 0 && ` · ${c.consecutiveOfflineMinutes}m`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert summary row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className={`border ${openCount > 0 ? 'border-red-900/40 bg-red-950/10' : 'border-slate-800 bg-slate-900/50'}`}>
          <CardContent className="p-3">
            <p className="text-xs text-slate-500">Open events</p>
            <p className={`text-2xl font-bold ${openCount > 0 ? 'text-red-300' : 'text-green-300'}`}>{openCount}</p>
          </CardContent>
        </Card>
        <Card className={`border ${criticalEvents.length > 0 ? 'border-red-900/50 bg-red-950/20' : 'border-slate-800 bg-slate-900/50'}`}>
          <CardContent className="p-3">
            <p className="text-xs text-slate-500">Critical incidents</p>
            <p className={`text-2xl font-bold ${criticalEvents.length > 0 ? 'text-red-300' : 'text-slate-400'}`}>{criticalEvents.length}</p>
          </CardContent>
        </Card>
        <Card className={`border ${highEvents.length > 0 ? 'border-orange-900/40 bg-orange-950/10' : 'border-slate-800 bg-slate-900/50'}`}>
          <CardContent className="p-3">
            <p className="text-xs text-slate-500">High severity</p>
            <p className={`text-2xl font-bold ${highEvents.length > 0 ? 'text-orange-300' : 'text-slate-400'}`}>{highEvents.length}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500">Total safety events</p>
            <p className="text-2xl font-bold text-slate-200">{events.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Event type coverage */}
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-300">Safety Event Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SAFETY_EVENT_TYPES.map((type) => {
              const count = events.filter((e) => e.eventType === type).length;
              const isCritical = CRITICAL_EVENT_TYPES.includes(type);
              const isHigh = HIGH_EVENT_TYPES.includes(type);
              return (
                <Link
                  key={type}
                  href={`/dashboard/school-intelligence/events?eventType=${type}&status=Open`}
                  className={`flex items-center justify-between rounded-md border p-2.5 text-xs transition-colors hover:border-sky-700 ${
                    count > 0
                      ? isCritical ? 'border-red-900/50 bg-red-950/20' : isHigh ? 'border-orange-900/40 bg-orange-950/10' : 'border-amber-900/30 bg-amber-950/10'
                      : 'border-slate-800 bg-slate-900/40'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {EVENT_ICONS[type] ?? <ShieldAlert className="h-3.5 w-3.5 text-slate-500" />}
                    <span className={count > 0 ? 'text-slate-200' : 'text-slate-500'}>{type}</span>
                  </span>
                  {count > 0 ? (
                    <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${isCritical ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}`}>
                      {count}
                    </span>
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  )}
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Live event feed */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-200">Safety Event Feed</p>
          <div className="flex rounded border border-slate-700 overflow-hidden text-xs">
            {(['Open', 'All'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 transition-colors ${statusFilter === s ? 'bg-sky-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {eventsLoading ? (
          <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading events…</p>
        ) : events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-600" />
            <p className="text-sm text-slate-400">No {statusFilter === 'Open' ? 'open ' : ''}safety events.</p>
            <p className="mt-1 text-xs text-slate-600">
              Seed signals → evaluate rules to generate safety events.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((e) => (
              <Link
                key={e.id}
                href={`/dashboard/school-intelligence/events/${e.id}`}
                className={`flex items-start gap-3 rounded-lg border border-l-4 border-slate-800 p-3 transition-colors hover:border-slate-700 ${SEVERITY_LEFT[e.severity] ?? 'border-l-slate-700'}`}
              >
                <div className="mt-0.5 shrink-0">
                  {EVENT_ICONS[e.eventType] ?? <ShieldAlert className="h-4 w-4 text-slate-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-100 text-sm">{e.eventType}</span>
                    <span className={`rounded border px-1.5 py-0.5 text-xs font-medium ${SEVERITY_COLORS[e.severity] ?? ''}`}>
                      {e.severity}
                    </span>
                    <span className={`text-xs ${e.status === 'Open' ? 'text-red-400' : e.status === 'Resolved' ? 'text-green-400' : 'text-amber-400'}`}>
                      {e.status}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-400">{e.evidence?.summary}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {new Date(e.startedAt).toLocaleString()}
                    {e.cameraId && ` · Camera #${e.cameraId}`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Score drivers */}
      {(safetyScore.drivers.length > 0 || securityScore.drivers.length > 0) && (
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Score Drivers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Safety', drivers: safetyScore.drivers },
              { label: 'Security', drivers: securityScore.drivers },
            ].map(({ label, drivers }) =>
              drivers.length > 0 ? (
                <div key={label}>
                  <p className="mb-2 text-xs font-medium text-slate-500">{label}</p>
                  <div className="space-y-1.5">
                    {drivers.map((d) => (
                      <div key={d.key} className="flex items-center justify-between text-xs">
                        <span className="text-slate-300">{d.label}</span>
                        <span className={d.impact >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {d.impact >= 0 ? '+' : ''}{d.impact}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
