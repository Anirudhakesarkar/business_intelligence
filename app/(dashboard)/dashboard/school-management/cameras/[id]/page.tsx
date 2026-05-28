'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { SMPageHeader } from '@/components/school-management/SMPageHeader';
import { schoolApiGet } from '@/lib/school-management/api';
import { Card, CardContent } from '@/components/ui/card';

type CameraRow = {
  id: number;
  cameraCode: string;
  name: string;
  purpose: string;
  processOwner: string;
  criticality: string;
  status: string;
  zoneId?: number;
  roomId?: number;
  streamUrl?: string;
  activeFrom?: string;
  activeTo?: string;
};

export default function CameraDetailPage() {
  const params = useParams();
  const cameraId = Number(params.id);
  const { data, isLoading, error } = useQuery({
    queryKey: ['sm-camera', cameraId],
    queryFn: () => schoolApiGet<CameraRow>(`/api/cameras/${cameraId}`),
    enabled: Number.isFinite(cameraId) && cameraId > 0,
  });

  const cam = data;

  return (
    <div className="space-y-6">
      <SMPageHeader
        title={cam ? `${cam.cameraCode} — ${cam.name}` : 'Camera detail'}
        subtitle="Governance fields for this camera (mapping, purpose, and status)."
      />

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/dashboard/school-management/cameras" className="text-sky-400 hover:underline">
          ← Cameras and mapping
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : error || !cam ? (
        <p className="text-sm text-red-400">Camera not found.</p>
      ) : (
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="space-y-2 p-4 text-sm">
            <p>
              <span className="text-slate-500">Code:</span> <span className="font-mono text-slate-200">{cam.cameraCode}</span>
            </p>
            <p>
              <span className="text-slate-500">Name:</span> {cam.name}
            </p>
            <p>
              <span className="text-slate-500">Purpose:</span> {cam.purpose}
            </p>
            <p>
              <span className="text-slate-500">Process owner:</span> {cam.processOwner}
            </p>
            <p>
              <span className="text-slate-500">Criticality:</span> {cam.criticality}
            </p>
            <p>
              <span className="text-slate-500">Status:</span> {cam.status}
            </p>
            {cam.zoneId != null && (
              <p>
                <span className="text-slate-500">Zone ID:</span> {cam.zoneId}
              </p>
            )}
            {cam.roomId != null && (
              <p>
                <span className="text-slate-500">Room ID:</span> {cam.roomId}
              </p>
            )}
            {(cam.activeFrom || cam.activeTo) && (
              <p>
                <span className="text-slate-500">Active hours:</span>{' '}
                {cam.activeFrom ?? '—'}–{cam.activeTo ?? '—'}
              </p>
            )}
            {cam.streamUrl && (
              <p className="truncate">
                <span className="text-slate-500">Stream URL:</span>{' '}
                <span className="text-slate-400">{cam.streamUrl}</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
