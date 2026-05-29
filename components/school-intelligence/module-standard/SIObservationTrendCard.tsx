'use client';

import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ObservationBucket } from '@/lib/school-intelligence/module-standard/types';

type Props = {
  buckets: ObservationBucket[];
  periodLabel: string;
};

export function SIObservationTrendCard({ buckets, periodLabel }: Props) {
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  const max = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <Card className="border-slate-800 bg-slate-900/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-slate-200">
          <BarChart3 className="h-4 w-4 text-sky-400" aria-hidden />
          Observation trend
        </CardTitle>
        <p className="text-xs font-normal text-slate-500">{periodLabel}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div>
              <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-100">{total}</p>
              <p className="text-xs text-slate-500">Total observations · {periodLabel}</p>
            </div>
            <p className="text-[11px] text-slate-600">
              {buckets.length} {buckets.length === 1 ? 'bucket' : 'buckets'} in range
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800/60 bg-slate-950/30 px-3 py-4">
            <div className="relative h-32 min-w-0">
              <div
                className="pointer-events-none absolute inset-0 flex flex-col justify-between"
                aria-hidden
              >
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="border-t border-dashed border-slate-800/60" />
                ))}
              </div>
              <div className="relative flex h-full min-w-0 items-end gap-2 sm:gap-2.5">
                {buckets.map((b) => {
                  const heightPct = (b.count / max) * 100;
                  const barHeightPct = Math.max(heightPct, b.count > 0 ? 14 : 2);
                  const barHeight = b.count > 0
                    ? `max(1.5rem, calc(8rem * ${barHeightPct} / 100))`
                    : '2px';
                  return (
                    <div
                      key={b.key}
                      className="flex h-full min-w-[2.75rem] flex-1 flex-col items-center justify-end sm:min-w-[3rem]"
                      title={`${b.subLabel ? `${b.subLabel}, ` : ''}${b.label}: ${b.count} observation${b.count === 1 ? '' : 's'}`}
                    >
                      {b.count > 0 && (
                        <span className="mb-0.5 w-full shrink-0 text-center text-[10px] font-bold leading-none tabular-nums text-slate-200 sm:text-[11px]">
                          {b.count}
                        </span>
                      )}
                      <div
                        className="w-full overflow-hidden rounded-t-md bg-gradient-to-t from-sky-700 to-sky-400 shadow-sm shadow-sky-950/40 transition-all hover:from-sky-600 hover:to-sky-300"
                        style={{ height: barHeight }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-2 flex min-w-0 gap-2 sm:gap-2.5">
              {buckets.map((b) => (
                <div
                  key={b.key}
                  className="flex min-w-[2.75rem] flex-1 flex-col items-center gap-0.5 text-center sm:min-w-[3rem]"
                  title={b.subLabel ? `${b.subLabel}, ${b.label}` : b.label}
                >
                  <span className="w-full truncate text-[9px] leading-tight text-slate-500 sm:text-[10px]">
                    {b.label}
                  </span>
                  {b.subLabel && (
                    <span className="w-full truncate text-[8px] leading-tight text-slate-600 sm:text-[9px]">
                      {b.subLabel}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
