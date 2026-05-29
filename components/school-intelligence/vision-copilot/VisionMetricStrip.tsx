'use client';

import { Camera, Activity, ShieldAlert, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const METRICS = [
  {
    label: 'Active Cameras',
    value: '22 / 24',
    trend: '2 offline',
    icon: Camera,
    trendClass: 'text-amber-400',
  },
  {
    label: 'Events Today',
    value: '148',
    trend: '+12 vs yesterday',
    icon: Activity,
    trendClass: 'text-sky-400',
  },
  {
    label: 'Risk Level',
    value: 'Medium',
    trend: 'Elevated at gate',
    icon: ShieldAlert,
    trendClass: 'text-amber-400',
  },
  {
    label: 'Avg Response',
    value: '6m 42s',
    trend: 'Within SLA',
    icon: Clock,
    trendClass: 'text-green-400',
  },
] as const;

export function VisionMetricStrip() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {METRICS.map(({ label, value, trend, icon: Icon, trendClass }) => (
        <Card key={label} className="border-slate-800 bg-slate-900">
          <CardContent className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-semibold text-slate-100">{value}</p>
                <p className={cn('mt-0.5 truncate text-xs', trendClass)}>{trend}</p>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 text-sky-400">
                <Icon className="h-4 w-4" aria-hidden />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
