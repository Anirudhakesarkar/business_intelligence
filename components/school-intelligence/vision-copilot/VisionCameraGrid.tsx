'use client';

import { Camera } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { VisionCamera } from '@/lib/school-intelligence/vision-copilot-mock';
import { cn } from '@/lib/utils';

type Props = {
  cameras: VisionCamera[];
  selectedId: string;
  onSelect: (id: string) => void;
};

const STATUS_DOT: Record<VisionCamera['status'], string> = {
  online: 'bg-green-400',
  degraded: 'bg-amber-400',
  offline: 'bg-red-400',
};

const RISK_BADGE: Record<VisionCamera['risk'], 'success' | 'warning' | 'destructive'> = {
  low: 'success',
  medium: 'warning',
  high: 'destructive',
};

export function VisionCameraGrid({ cameras, selectedId, onSelect }: Props) {
  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-100">Camera grid</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cameras.map((cam) => {
            const selected = cam.id === selectedId;
            return (
              <button
                key={cam.id}
                type="button"
                onClick={() => onSelect(cam.id)}
                aria-pressed={selected}
                className={cn(
                  'rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
                  selected
                    ? 'border-sky-600/60 bg-sky-950/20 ring-1 ring-sky-500/30'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                )}
              >
                <div className="relative aspect-video overflow-hidden rounded-t-lg bg-slate-950">
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage:
                        'linear-gradient(rgba(148,163,184,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.15) 1px, transparent 1px)',
                      backgroundSize: '16px 16px',
                    }}
                    aria-hidden
                  />
                  <Camera className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-slate-600" aria-hidden />
                  <span
                    className={cn('absolute right-2 top-2 h-2 w-2 rounded-full', STATUS_DOT[cam.status])}
                    aria-label={`Status: ${cam.status}`}
                  />
                </div>
                <div className="space-y-1.5 p-3">
                  <p className="truncate text-sm font-medium text-slate-200">{cam.name}</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">Last event {cam.lastEvent}</span>
                    <Badge variant={RISK_BADGE[cam.risk]} className="capitalize">
                      {cam.risk}
                    </Badge>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
