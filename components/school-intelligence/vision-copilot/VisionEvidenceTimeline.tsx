'use client';

import { AlertTriangle, Info, CheckCircle2, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { VisionEvent } from '@/lib/school-intelligence/vision-copilot-mock';
import { cn } from '@/lib/utils';

type Props = {
  events: VisionEvent[];
  highlightCamera?: string;
};

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', variant: 'destructive' as const, icon: AlertTriangle, row: 'border-l-red-500' },
  watch: { label: 'Watch', variant: 'warning' as const, icon: Eye, row: 'border-l-amber-500' },
  info: { label: 'Info', variant: 'secondary' as const, icon: Info, row: 'border-l-sky-500' },
  resolved: { label: 'Resolved', variant: 'success' as const, icon: CheckCircle2, row: 'border-l-green-500' },
};

export function VisionEvidenceTimeline({ events, highlightCamera }: Props) {
  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-100">Evidence timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {events.map((event) => {
          const cfg = SEVERITY_CONFIG[event.severity];
          const Icon = cfg.icon;
          const highlighted = highlightCamera && event.camera === highlightCamera;
          return (
            <div
              key={event.id}
              className={cn(
                'flex flex-col gap-2 rounded-lg border border-slate-800 border-l-4 bg-slate-950/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between',
                cfg.row,
                highlighted && 'ring-1 ring-sky-500/30'
              )}
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200">{event.title}</p>
                  <p className="truncate text-xs text-slate-500">{event.camera}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 pl-6 sm:pl-0">
                <span className="text-xs tabular-nums text-slate-500">{event.time}</span>
                <Badge variant={cfg.variant}>{cfg.label}</Badge>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
