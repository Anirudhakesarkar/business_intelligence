'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { SMPageHeader } from '@/components/school-management/SMPageHeader';
import { SchoolAiBreadcrumbs } from '@/components/school-management/SchoolAiBreadcrumbs';
import { useSignalTimeline, useSeedAiSignals } from '@/components/school-management/useSchoolAiSignals';
import { useCameras } from '@/components/school-management/useSchoolFoundation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, Camera, Filter, RefreshCw, Cpu } from 'lucide-react';

type AiSignal = {
  id: number;
  cameraId: number;
  signalType: string;
  signalValue: number;
  confidence?: number;
  observedAt: string;
  metadata?: Record<string, unknown>;
};

const SIGNAL_TYPES = [
  'PersonCount', 'PersonTracking', 'AdultPresent', 'TeacherPresent', 'CrowdDensity',
  'Running', 'Loitering', 'ZoneEntry', 'Fall', 'FireSmoke', 'Tamper', 'Offline',
  'TeacherNearBoard', 'TeacherSeatedIdle', 'SubstituteTeacherPresent', 'ClassStartTime', 'ClassEndTime',
  'RoomOccupied', 'RoomEmpty', 'UsageDuration',
  'VehicleQueue', 'ReceptionQueue', 'DispersalDelay',
  'StaffPresentAtGate', 'StaffPresentAtCorridor', 'StaffPresentAtPlayground',
];

const SIGNAL_COLORS: Record<string, string> = {
  PersonCount: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  PersonTracking: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  AdultPresent: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  TeacherPresent: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  TeacherNearBoard: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  TeacherSeatedIdle: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  CrowdDensity: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  Running: 'bg-red-500/20 text-red-300 border-red-500/30',
  Loitering: 'bg-red-500/20 text-red-300 border-red-500/30',
  ZoneEntry: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  Fall: 'bg-red-600/20 text-red-300 border-red-600/30',
  FireSmoke: 'bg-red-700/20 text-red-400 border-red-700/30',
  Tamper: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  Offline: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  RoomOccupied: 'bg-green-500/20 text-green-300 border-green-500/30',
  RoomEmpty: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  ClassStartTime: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  ClassEndTime: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  StaffPresentAtGate: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  StaffPresentAtCorridor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  StaffPresentAtPlayground: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
};

function ConfidenceBar({ value }: { value?: number }) {
  if (value == null) return <span className="text-xs text-slate-600">—</span>;
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-slate-700">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400">{pct}%</span>
    </div>
  );
}

function SignalBadge({ type }: { type: string }) {
  const cls = SIGNAL_COLORS[type] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${cls}`}>
      {type}
    </span>
  );
}

export default function SignalsTimelinePage() {
  const searchParams = useSearchParams();
  const [filterCamera, setFilterCamera] = useState('');
  useEffect(() => {
    const id = searchParams.get('cameraId');
    if (id) setFilterCamera(id);
  }, [searchParams]);
  const [filterType, setFilterType] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [minConfidence, setMinConfidence] = useState(0);

  const { data: signalData, isLoading, refetch } = useSignalTimeline(
    filterCamera ? { cameraId: Number(filterCamera) } : undefined
  );
  const { data: cameraData } = useCameras();
  const seed = useSeedAiSignals();

  const cameras = (cameraData as { cameras?: { id: number; code: string; purpose: string }[] })?.cameras ?? [];
  const allSignals: AiSignal[] = (signalData as { signals?: AiSignal[] })?.signals ?? [];

  const signals = useMemo(() => {
    return allSignals.filter((s) => {
      if (filterType && s.signalType !== filterType) return false;
      if (filterFrom && s.observedAt < filterFrom) return false;
      if (filterTo && s.observedAt > filterTo + 'T23:59:59') return false;
      if (minConfidence > 0 && (s.confidence ?? 0) < minConfidence / 100) return false;
      return true;
    });
  }, [allSignals, filterType, filterFrom, filterTo, minConfidence]);

  // Stats summary
  const typeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    allSignals.forEach((s) => { counts[s.signalType] = (counts[s.signalType] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [allSignals]);

  const avgConf = useMemo(() => {
    const vals = allSignals.filter((s) => s.confidence != null).map((s) => s.confidence!);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length * 100).toFixed(1) : null;
  }, [allSignals]);

  return (
    <div className="space-y-6">
      <SchoolAiBreadcrumbs current="Signal Timeline" extra={{ href: '/dashboard/school-management/ai-health', label: 'AI Health' }} />
      <SMPageHeader title="Signal Timeline" subtitle="Ingested AI signals across cameras — filter by type, camera, date, and confidence." />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500">Total signals</p>
            <p className="text-2xl font-bold text-slate-100">{allSignals.length}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500">Filtered</p>
            <p className="text-2xl font-bold text-sky-400">{signals.length}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500">Signal types</p>
            <p className="text-2xl font-bold text-slate-100">{new Set(allSignals.map((s) => s.signalType)).size}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500">Avg confidence</p>
            <p className="text-2xl font-bold text-green-400">{avgConf != null ? `${avgConf}%` : '—'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Top signal types */}
      {typeBreakdown.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {typeBreakdown.map(([type, count]) => (
            <button
              key={type}
              onClick={() => setFilterType(filterType === type ? '' : type)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                filterType === type
                  ? 'border-sky-500 bg-sky-500/20 text-sky-300'
                  : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
              }`}
            >
              <Activity className="h-3 w-3" />
              {type}
              <span className="ml-1 rounded-full bg-slate-700 px-1.5 text-slate-300">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <Filter className="mb-1 h-4 w-4 text-slate-500" />

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Camera</label>
          <select
            value={filterCamera}
            onChange={(e) => setFilterCamera(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
          >
            <option value="">All cameras</option>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>{c.code} ({c.purpose})</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Signal type</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
          >
            <option value="">All types</option>
            {SIGNAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">From date</label>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">To date</label>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Min confidence: {minConfidence}%</label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={minConfidence}
            onChange={(e) => setMinConfidence(Number(e.target.value))}
            className="w-28 accent-sky-500"
          />
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setFilterCamera(''); setFilterType(''); setFilterFrom(''); setFilterTo(''); setMinConfidence(0); }}
          >
            Clear
          </Button>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-1 h-3 w-3" /> Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const cap = signals.slice(0, 10_000);
              const header = 'cameraId,signalType,signalValue,confidence,observedAt\n';
              const body = cap.map((s) => `${s.cameraId},${s.signalType},${s.signalValue},${s.confidence ?? ''},${s.observedAt}`).join('\n');
              const blob = new Blob([header + body], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'signals-export.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export CSV (max 10k)
          </Button>
          <Button size="sm" onClick={() => seed.mutate()} disabled={seed.isPending}>
            <Cpu className="mr-1 h-3 w-3" />
            {seed.isPending ? 'Seeding…' : 'Seed signals'}
          </Button>
        </div>
      </div>

      <Card className="border-slate-800 bg-slate-900/40">
        <CardContent className="p-3 text-xs text-slate-500">
          Raw AI evidence only — not management conclusions or GPT summaries. Export is capped at 10,000 rows.
        </CardContent>
      </Card>

      {/* Timeline table */}
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : signals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center">
          <Activity className="mx-auto mb-2 h-8 w-8 text-slate-600" />
          <p className="text-sm text-slate-500">No signals match filters. Try seeding demo data or adjusting filters.</p>
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/80">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Camera</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Signal type</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Value</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Confidence</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Observed at</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {signals.slice(0, 200).map((s) => {
                const cam = cameras.find((c) => c.id === s.cameraId);
                return (
                  <tr key={s.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-2 text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Camera className="h-3 w-3 text-slate-500" />
                        {cam ? <span>{cam.code}</span> : <span className="text-slate-500">#{s.cameraId}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2"><SignalBadge type={s.signalType} /></td>
                    <td className="px-4 py-2 font-mono text-slate-200">{s.signalValue}</td>
                    <td className="px-4 py-2"><ConfidenceBar value={s.confidence} /></td>
                    <td className="px-4 py-2 text-xs text-slate-400">
                      {new Date(s.observedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {s.metadata && Object.keys(s.metadata).length > 0
                        ? Object.entries(s.metadata).map(([k, v]) => `${k}:${v}`).join(', ')
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {signals.length > 200 && (
            <p className="border-t border-slate-800 px-4 py-2 text-xs text-slate-500">
              Showing 200 of {signals.length} signals. Add filters to narrow results.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
