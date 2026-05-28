'use client';

import { useState } from 'react';
import { SMPageHeader } from '@/components/school-management/SMPageHeader';
import { SchoolAiBreadcrumbs } from '@/components/school-management/SchoolAiBreadcrumbs';
import { useAiWorkers, useSeedAiSignals } from '@/components/school-management/useSchoolAiSignals';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, Cpu, Wifi, WifiOff, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

type AiWorker = {
  id: number;
  workerKey: string;
  workerType: string;
  version: string;
  status: 'Healthy' | 'Unhealthy' | 'Stale';
  capabilities: string[];
  registeredAt: string;
  lastHeartbeatAt?: string;
  processingConfig?: {
    cameraId: number;
    sampleRate: number;
    minConfidence: number;
    enabledSignals: string[];
    snapshotEnabled: boolean;
    activeProcessing: boolean;
  };
};

type WorkerData = {
  workers?: AiWorker[];
};

const STATUS_CONFIG = {
  Healthy: { label: 'Healthy', icon: CheckCircle2, cls: 'text-green-400 bg-green-500/10 border-green-500/30' },
  Unhealthy: { label: 'Unhealthy', icon: WifiOff, cls: 'text-red-400 bg-red-500/10 border-red-500/30' },
  Stale: { label: 'Stale', icon: AlertTriangle, cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
};

function StatusBadge({ status }: { status: 'Healthy' | 'Unhealthy' | 'Stale' }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.Stale;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function HeartbeatAge({ ts }: { ts?: string }) {
  if (!ts) return <span className="text-xs text-slate-600">Never</span>;
  const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  let label: string;
  let cls = 'text-green-400';
  if (seconds < 60) { label = `${seconds}s ago`; }
  else if (seconds < 3600) { label = `${Math.floor(seconds / 60)}m ago`; }
  else { label = `${Math.floor(seconds / 3600)}h ago`; cls = 'text-amber-400'; }
  if (seconds > 300) cls = 'text-amber-400';
  if (seconds > 3600) cls = 'text-red-400';
  return <span className={`text-xs ${cls}`}>{label}</span>;
}

function WorkerCard({ w }: { w: AiWorker }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = w.processingConfig;
  return (
    <Card className="border-slate-800 bg-slate-900/50 transition-colors hover:border-slate-700">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg border border-slate-700 bg-slate-800 p-2">
              <Cpu className="h-4 w-4 text-sky-400" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-slate-100">{w.workerKey}</p>
              <p className="text-xs text-slate-400">{w.workerType} · v{w.version}</p>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="h-3 w-3" />
                <span>Heartbeat:</span>
                <HeartbeatAge ts={w.lastHeartbeatAt} />
              </div>
            </div>
          </div>
          <StatusBadge status={w.status} />
        </div>

        {/* Capabilities */}
        {w.capabilities?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {w.capabilities.map((cap) => (
              <span key={cap} className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                {cap}
              </span>
            ))}
          </div>
        )}

        {/* Processing config toggle */}
        {cfg && (
          <div className="mt-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-sky-400 hover:underline"
            >
              {expanded ? '▲ Hide' : '▼ Show'} processing config
            </button>
            {expanded && (
              <div className="mt-2 rounded-md border border-slate-800 bg-slate-950/50 p-3 text-xs space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="text-slate-500">Camera ID</span>
                  <span className="text-slate-300">#{cfg.cameraId}</span>
                  <span className="text-slate-500">Sample rate</span>
                  <span className="text-slate-300">{cfg.sampleRate}s</span>
                  <span className="text-slate-500">Min confidence</span>
                  <span className="text-slate-300">{(cfg.minConfidence * 100).toFixed(0)}%</span>
                  <span className="text-slate-500">Snapshot</span>
                  <span className={cfg.snapshotEnabled ? 'text-green-400' : 'text-slate-500'}>
                    {cfg.snapshotEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <span className="text-slate-500">Active</span>
                  <span className={cfg.activeProcessing ? 'text-green-400' : 'text-red-400'}>
                    {cfg.activeProcessing ? 'Yes' : 'No'}
                  </span>
                </div>
                {cfg.enabledSignals?.length > 0 && (
                  <div>
                    <p className="mb-1 text-slate-500">Enabled signals ({cfg.enabledSignals.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {cfg.enabledSignals.map((s) => (
                        <span key={s} className="rounded bg-sky-900/30 px-1.5 py-0.5 text-sky-400">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <p className="mt-3 text-xs text-slate-600">
          Registered {new Date(w.registeredAt).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );
}

export default function WorkersPage() {
  const { data, isLoading, refetch } = useAiWorkers();
  const seed = useSeedAiSignals();
  const qc = useQueryClient();
  const workerData = data as WorkerData;
  const workers: AiWorker[] = workerData?.workers ?? [];

  const healthy = workers.filter((w) => w.status === 'Healthy').length;
  const stale = workers.filter((w) => w.status === 'Stale').length;
  const unhealthy = workers.filter((w) => w.status === 'Unhealthy').length;

  return (
    <div className="space-y-6">
      <SchoolAiBreadcrumbs current="Worker Health" extra={{ href: '/dashboard/school-management/ai-health', label: 'AI Health' }} />
      <SMPageHeader title="AI Workers" subtitle="Edge worker registry — heartbeat metrics and processing configuration." />

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => { seed.mutate(); }} disabled={seed.isPending}>
          <Cpu className="mr-1 h-3 w-3" />
          {seed.isPending ? 'Seeding…' : 'Seed workers + signals'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => { refetch(); qc.invalidateQueries({ queryKey: ['ai-workers'] }); }}>
          <RefreshCw className="mr-1 h-3 w-3" /> Refresh
        </Button>
      </div>

      {/* Status summary */}
      {workers.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-green-900/40 bg-green-950/20">
            <CardContent className="flex items-center gap-3 p-3">
              <Wifi className="h-5 w-5 text-green-400" />
              <div>
                <p className="text-xs text-green-500">Healthy</p>
                <p className="text-xl font-bold text-green-300">{healthy}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-900/40 bg-amber-950/20">
            <CardContent className="flex items-center gap-3 p-3">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <div>
                <p className="text-xs text-amber-500">Stale</p>
                <p className="text-xl font-bold text-amber-300">{stale}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-900/40 bg-red-950/20">
            <CardContent className="flex items-center gap-3 p-3">
              <WifiOff className="h-5 w-5 text-red-400" />
              <div>
                <p className="text-xs text-red-500">Unhealthy</p>
                <p className="text-xl font-bold text-red-300">{unhealthy}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Workers grid */}
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : workers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center">
          <Cpu className="mx-auto mb-2 h-8 w-8 text-slate-600" />
          <p className="text-sm text-slate-500">No workers registered. Seed AI signals to register demo workers.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {workers.map((w) => <WorkerCard key={w.id} w={w} />)}
        </div>
      )}
    </div>
  );
}
