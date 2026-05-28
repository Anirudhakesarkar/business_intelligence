'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { SMPageHeader } from '@/components/school-management/SMPageHeader';
import { SchoolAiBreadcrumbs } from '@/components/school-management/SchoolAiBreadcrumbs';
import { useCameraAiDetail } from '@/components/school-management/useSchoolAiSignals';
import { Card, CardContent } from '@/components/ui/card';
import type { HealthStatus } from '@/lib/school-ai-signals/types';

type Detail = {
  camera?: {
    id: number;
    name: string;
    cameraCode: string;
    purpose: string;
    criticality: string;
    processOwner?: string;
    zoneId?: number;
    roomId?: number;
  };
  freshness?: { stale: boolean; lastSignalAt?: string; missingTypes?: string[] };
  config?: {
    sampleRate: number;
    minConfidence: number;
    enabledSignals: string[];
    snapshotEnabled: boolean;
    activeProcessing: boolean;
  };
  recentSignals?: { signalType: string; signalValue: number; confidence?: number; observedAt: string }[];
  health?: { id: number; healthStatus: HealthStatus; startedAt: string; endedAt?: string }[];
  recentBatches?: { id: number; batchKey: string; startedAt: string; endedAt?: string; frameCount: number }[];
};

const HEALTH_COLORS: Record<HealthStatus, string> = {
  Online: 'bg-green-500',
  Offline: 'bg-red-500',
  Unstable: 'bg-amber-500',
  Tampered: 'bg-yellow-500',
  Maintenance: 'bg-slate-500',
};

export default function CameraDetailPage() {
  const params = useParams();
  const cameraId = Number(params.id);
  const { data, isLoading } = useCameraAiDetail(cameraId);
  const detail = data as Detail | undefined;
  const cam = detail?.camera;
  const timelineHref = `/dashboard/school-management/signals?cameraId=${cameraId}`;

  return (
    <div className="space-y-6">
      <SchoolAiBreadcrumbs
        current={cam ? cam.cameraCode : 'Camera detail'}
        extra={{ href: '/dashboard/school-management/ai-health', label: 'AI Health' }}
      />
      <SMPageHeader
        title={cam ? `${cam.cameraCode} — ${cam.name}` : 'Camera detail'}
        subtitle="Health timeline, recent signals, and processing configuration."
      />

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/dashboard/school-management/ai-health" className="text-sky-400 hover:underline">
          ← AI Health grid
        </Link>
        <Link href={timelineHref} className="text-sky-400 hover:underline">
          Open signal timeline →
        </Link>
        <Link href="/dashboard/school-management/cameras" className="text-slate-400 hover:underline">
          Camera mapping
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !cam ? (
        <p className="text-sm text-red-400">Camera not found.</p>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-slate-800 bg-slate-900/50 lg:col-span-1">
              <CardContent className="space-y-2 p-4 text-sm">
                <p>
                  <span className="text-slate-500">Purpose:</span> {cam.purpose}
                </p>
                <p>
                  <span className="text-slate-500">Criticality:</span> {cam.criticality}
                </p>
                {cam.processOwner && (
                  <p>
                    <span className="text-slate-500">Process owner:</span> {cam.processOwner}
                  </p>
                )}
                <p>
                  <span className="text-slate-500">Freshness:</span>{' '}
                  <span className={detail?.freshness?.stale ? 'text-amber-400' : 'text-emerald-400'}>
                    {detail?.freshness?.stale ? 'Stale' : 'Fresh'}
                  </span>
                </p>
                {detail?.freshness?.lastSignalAt && (
                  <p className="text-xs text-slate-500">
                    Last signal: {new Date(detail.freshness.lastSignalAt).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50 lg:col-span-2">
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-medium text-slate-200">Health timeline (recent)</h3>
                {(detail?.health?.length ?? 0) === 0 ? (
                  <p className="text-xs text-slate-500">No health events recorded.</p>
                ) : (
                  <ul className="space-y-2">
                    {(detail?.health ?? []).map((e) => (
                      <li key={e.id} className="flex items-center gap-3 text-xs">
                        <span className={`h-2 w-2 rounded-full ${HEALTH_COLORS[e.healthStatus]}`} />
                        <span className="font-medium text-slate-300">{e.healthStatus}</span>
                        <span className="text-slate-500">
                          {new Date(e.startedAt).toLocaleString()}
                          {e.endedAt ? ` → ${new Date(e.endedAt).toLocaleTimeString()}` : ' (open)'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-slate-800 bg-slate-900/50">
              <CardContent className="p-4">
                <h3 className="mb-2 text-sm font-medium text-slate-200">Processing config (read-only)</h3>
                {detail?.config ? (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <dt className="text-slate-500">Sample rate</dt>
                    <dd className="text-slate-300">{detail.config.sampleRate}s</dd>
                    <dt className="text-slate-500">Min confidence</dt>
                    <dd className="text-slate-300">{(detail.config.minConfidence * 100).toFixed(0)}%</dd>
                    <dt className="text-slate-500">Snapshots</dt>
                    <dd className="text-slate-300">{detail.config.snapshotEnabled ? 'Enabled' : 'Disabled'}</dd>
                    <dt className="text-slate-500">Active</dt>
                    <dd className="text-slate-300">{detail.config.activeProcessing ? 'Yes' : 'No'}</dd>
                    <dt className="col-span-2 text-slate-500">Enabled signals</dt>
                    <dd className="col-span-2 flex flex-wrap gap-1">
                      {detail.config.enabledSignals.map((s) => (
                        <span key={s} className="rounded bg-slate-800 px-1.5 py-0.5 text-sky-400">
                          {s}
                        </span>
                      ))}
                    </dd>
                  </dl>
                ) : (
                  <p className="text-xs text-slate-500">No processing config.</p>
                )}
                <p className="mt-3 text-xs text-slate-600">
                  Diagnostic snapshots respect blur policy; unauthorized roles cannot access media URLs.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50">
              <CardContent className="p-4">
                <h3 className="mb-2 text-sm font-medium text-slate-200">Recent signal batches</h3>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-slate-400">
                  {(detail?.recentBatches ?? []).length === 0 && <li>No batches yet.</li>}
                  {(detail?.recentBatches ?? []).map((b) => (
                    <li key={b.id}>
                      {b.batchKey} · {b.frameCount} frames · {new Date(b.startedAt).toLocaleTimeString()}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-800 bg-slate-900/50">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-200">Recent signals</h3>
                <Link href={timelineHref} className="text-xs text-sky-400 hover:underline">
                  Full day replay →
                </Link>
              </div>
              <ul className="max-h-64 space-y-1 overflow-y-auto text-xs text-slate-400">
                {(detail?.recentSignals ?? []).slice(0, 40).map((s, i) => (
                  <li key={i}>
                    {s.observedAt.slice(11, 19)} · {s.signalType} = {Number(s.signalValue).toFixed(2)}
                    {s.confidence != null ? ` (${Math.round(s.confidence * 100)}%)` : ''}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
