'use client';

import { CircleDot, ScanEye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { VisionCamera } from '@/lib/school-intelligence/vision-copilot-mock';
import { SCENE_DETECTIONS } from '@/lib/school-intelligence/vision-copilot-mock';
import { cn } from '@/lib/utils';

type Props = {
  camera: VisionCamera;
};

const RISK_LABEL: Record<VisionCamera['risk'], string> = {
  low: 'Low',
  medium: 'Moderate',
  high: 'Elevated',
};

const RISK_CLASS: Record<VisionCamera['risk'], string> = {
  low: 'text-green-400',
  medium: 'text-amber-400',
  high: 'text-red-400',
};

export function VisionScenePanel({ camera }: Props) {
  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <div className="min-w-0">
          <CardTitle className="truncate text-base text-slate-100">{camera.name}</CardTitle>
          <p className="text-xs text-slate-500">{camera.zone}</p>
        </div>
        <Badge variant="default" className="gap-1.5">
          <CircleDot className="h-3 w-3 animate-pulse" aria-hidden />
          Analyzing
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative aspect-video overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'linear-gradient(rgba(56,189,248,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.08) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-slate-950/40" />

          <div className="absolute left-[18%] top-[28%] h-[32%] w-[28%] rounded border-2 border-sky-400/70 bg-sky-500/10">
            <span className="absolute -top-6 left-0 rounded bg-sky-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
              Vehicle at gate
            </span>
          </div>
          <div className="absolute right-[12%] top-[20%] h-[45%] w-[22%] rounded border-2 border-amber-400/60 bg-amber-500/10">
            <span className="absolute -top-6 left-0 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
              Queue forming
            </span>
          </div>

          <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
            {SCENE_DETECTIONS.map((label) => (
              <span
                key={label}
                className="rounded-md border border-slate-700/80 bg-slate-900/90 px-2 py-0.5 text-[10px] text-slate-300"
              >
                {label}
              </span>
            ))}
            <span className="rounded-md border border-sky-700/60 bg-sky-950/80 px-2 py-0.5 text-[10px] text-sky-300">
              Camera confidence: {camera.confidence}%
            </span>
          </div>

          <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900/90 px-2 py-1 text-[10px] text-slate-400">
            <ScanEye className="h-3 w-3 text-sky-400" aria-hidden />
            Mock preview
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryBlock label="Current scene" value="Dispersal queue at north entry with moderate vehicle dwell." />
          <SummaryBlock
            label="Observed risk"
            value={RISK_LABEL[camera.risk]}
            valueClass={RISK_CLASS[camera.risk]}
          />
          <SummaryBlock
            label="Recommended action"
            value="Assign one guard during peak dispersal window."
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryBlock({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className={cn('mt-1 text-sm leading-snug text-slate-200', valueClass)}>{value}</p>
    </div>
  );
}
