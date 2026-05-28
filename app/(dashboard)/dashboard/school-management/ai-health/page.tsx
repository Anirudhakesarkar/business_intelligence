'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { SMPageHeader } from '@/components/school-management/SMPageHeader';
import { SchoolAiBreadcrumbs } from '@/components/school-management/SchoolAiBreadcrumbs';
import { useAiHealth, useSeedAiSignals } from '@/components/school-management/useSchoolAiSignals';
import { useCameras } from '@/components/school-management/useSchoolFoundation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { HealthStatus } from '@/lib/school-ai-signals/types';

type HealthRow = {
  camera: {
    id: number;
    name: string;
    cameraCode: string;
    purpose: string;
    criticality: string;
  };
  freshness: { stale: boolean; lastSignalAt?: string };
  latestHealth?: { healthStatus: HealthStatus };
  signalCount24h: number;
};

type HealthPayload = {
  kpis?: {
    totalActive: number;
    online: number;
    onlinePercent: number;
    staleCount: number;
    criticalOffline: number;
    tampered: number;
  };
  grid?: HealthRow[];
};

const STATUS_STYLES: Record<HealthStatus, string> = {
  Online: 'border-green-500/40 bg-green-500/10 text-green-300',
  Offline: 'border-red-500/40 bg-red-500/10 text-red-300',
  Unstable: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  Tampered: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300',
  Maintenance: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
};

function resolveStatus(row: HealthRow): HealthStatus {
  const ev = row.latestHealth?.healthStatus;
  if (ev === 'Tampered') return 'Tampered';
  if (ev === 'Unstable') return 'Unstable';
  if (ev === 'Maintenance') return 'Maintenance';
  if (row.freshness.stale || ev === 'Offline') return 'Offline';
  return 'Online';
}

type CameraHealthDaily = {
  score: number;
  offlineMinutes: number;
  tamperCount: number;
  criticalCamerasHealthy: number;
  criticalCamerasTotal: number;
  cameras: { cameraId: number; cameraCode: string; offlineMinutes: number; health: string }[];
};

export default function AiHealthPage() {
  const [purpose, setPurpose] = useState('');
  const [criticality, setCriticality] = useState('');
  const [staleOnly, setStaleOnly] = useState(false);
  const date = new Date().toISOString().slice(0, 10);
  const { data, isLoading, refetch } = useAiHealth();
  const healthScore = useQuery({
    queryKey: ['camera-health-daily', date],
    queryFn: async () => {
      const res = await fetch(`/api/camera-health/daily-score?organizationId=1&date=${date}`);
      return res.json() as Promise<CameraHealthDaily>;
    },
  });
  const { data: cameraData } = useCameras();
  const seed = useSeedAiSignals();

  const payload = data as HealthPayload | HealthRow[] | undefined;
  const grid: HealthRow[] = Array.isArray(payload) ? payload : payload?.grid ?? [];
  const kpis = Array.isArray(payload) ? null : payload?.kpis;

  const computedKpis = useMemo(() => {
    if (kpis) return kpis;
    let online = 0;
    let staleCount = 0;
    let criticalOffline = 0;
    for (const row of grid) {
      const s = resolveStatus(row);
      if (s === 'Online') online++;
      if (row.freshness.stale) staleCount++;
      if ((row.camera.criticality === 'Critical' || row.camera.criticality === 'High') && s !== 'Online') {
        criticalOffline++;
      }
    }
    const total = grid.length;
    return {
      totalActive: total,
      online,
      onlinePercent: total ? Math.round((online / total) * 100) : 0,
      staleCount,
      criticalOffline,
      tampered: grid.filter((r) => resolveStatus(r) === 'Tampered').length,
    };
  }, [grid, kpis]);

  const filtered = useMemo(() => {
    return grid.filter((row) => {
      if (purpose && row.camera.purpose !== purpose) return false;
      if (criticality && row.camera.criticality !== criticality) return false;
      if (staleOnly && !row.freshness.stale) return false;
      return true;
    });
  }, [grid, purpose, criticality, staleOnly]);

  const purposes = [...new Set(grid.map((r) => r.camera.purpose))].sort();
  const hasCameras = ((cameraData as { cameras?: unknown[] })?.cameras?.length ?? grid.length) > 0;

  return (
    <div className="space-y-6">
      <SchoolAiBreadcrumbs current="Cameras & AI Health" />
      <SMPageHeader
        title="Cameras & AI Health"
        subtitle="Stream health, signal freshness, and worker summary — operational evidence only (no management scores)."
      />

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => seed.mutate()} disabled={seed.isPending}>
          Seed demo signals
        </Button>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Refresh
        </Button>
        <Link href="/dashboard/school-management/workers">
          <Button size="sm" variant="outline">
            Worker health
          </Button>
        </Link>
        <Link href="/dashboard/school-management/signals">
          <Button size="sm" variant="outline">
            Signal timeline
          </Button>
        </Link>
      </div>

      {!hasCameras && !isLoading && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 text-sm text-amber-200">
            No cameras registered. Complete{' '}
            <Link href="/dashboard/school-management/cameras" className="text-sky-400 hover:underline">
              Phase 1 camera mapping
            </Link>{' '}
            first, then seed AI signals.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Card className="border-sky-900/50 bg-sky-950/20 sm:col-span-2">
          <CardContent className="p-3">
            <p className="text-xs text-sky-400/80">Camera Health Score (daily)</p>
            <p className="text-3xl font-bold text-sky-200">{healthScore.data?.score ?? '—'}</p>
            <p className="text-[10px] text-slate-500">
              Critical {healthScore.data?.criticalCamerasHealthy ?? '—'}/{healthScore.data?.criticalCamerasTotal ?? '—'} healthy
              · {healthScore.data?.offlineMinutes ?? 0} offline min · {healthScore.data?.tamperCount ?? 0} tamper
            </p>
          </CardContent>
        </Card>
        {[
          ['Active cameras', computedKpis.totalActive],
          ['Online', `${computedKpis.onlinePercent}%`],
          ['Critical offline', computedKpis.criticalOffline],
          ['Stale signals', computedKpis.staleCount],
          ['Tampered', computedKpis.tampered],
        ].map(([label, val]) => (
          <Card key={label} className="border-slate-800 bg-slate-900/50">
            <CardContent className="p-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-2xl font-bold text-slate-100">{val}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {healthScore.data && healthScore.data.cameras.some((c) => c.offlineMinutes > 0) && (
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Cameras reducing today&apos;s health score</p>
            <ul className="space-y-1 text-sm text-slate-300">
              {healthScore.data.cameras
                .filter((c) => c.offlineMinutes > 0)
                .map((c) => (
                  <li key={c.cameraId}>
                    {c.cameraCode}: {c.offlineMinutes} min offline ({c.health})
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <label className="text-xs text-slate-500">
          Purpose
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="mt-1 block rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
          >
            <option value="">All</option>
            {purposes.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-500">
          Criticality
          <select
            value={criticality}
            onChange={(e) => setCriticality(e.target.value)}
            className="mt-1 block rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
          >
            <option value="">All</option>
            {['Critical', 'High', 'Medium', 'Low'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={staleOnly} onChange={(e) => setStaleOnly(e.target.checked)} />
          Stale only
        </label>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading health grid…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500">No cameras match filters.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((row) => {
            const status = resolveStatus(row);
            return (
              <Card key={row.camera.id} className={`border ${STATUS_STYLES[status].split(' ')[0]} bg-slate-900/50`}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/dashboard/school-management/cameras/${row.camera.id}`}
                      className="font-medium text-sky-400 hover:underline"
                    >
                      {row.camera.cameraCode}
                    </Link>
                    <span className={`rounded border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
                      {status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{row.camera.name}</p>
                  <p className="text-xs text-slate-500">
                    {row.camera.purpose} · {row.camera.criticality}
                  </p>
                  <p className="text-xs text-slate-400">Signals (24h): {row.signalCount24h}</p>
                  <p className={`text-xs ${row.freshness.stale ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {row.freshness.stale ? 'Stale' : 'Fresh'}
                    {row.freshness.lastSignalAt
                      ? ` · ${new Date(row.freshness.lastSignalAt).toLocaleTimeString()}`
                      : ''}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
