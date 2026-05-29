'use client';

import { ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SIObservation, SIStandardModuleConfig } from '@/lib/school-intelligence/module-standard/types';

type Props = {
  config: SIStandardModuleConfig;
  observations: SIObservation[];
  periodLabel: string;
};

export function SIObservationTypesGrid({ config, observations, periodLabel }: Props) {
  return (
    <Card className="border-slate-800 bg-slate-900/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-300">
          Observation types
          <span className="ml-2 font-normal text-slate-500">· {periodLabel}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {config.observationTypes.map((typeCfg) => {
            const count = observations.filter((o) => o.type === typeCfg.type).length;
            const isCritical = typeCfg.isCritical ?? typeCfg.severity === 'Critical';
            const isHigh = typeCfg.isHigh ?? typeCfg.severity === 'High';
            return (
              <div
                key={typeCfg.type}
                className={`flex flex-col gap-1 rounded-md border p-2.5 text-xs ${
                  count > 0
                    ? isCritical
                      ? 'border-red-900/50 bg-red-950/20'
                      : isHigh
                        ? 'border-orange-900/40 bg-orange-950/10'
                        : 'border-amber-900/30 bg-amber-950/10'
                    : 'border-slate-800 bg-slate-900/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {config.typeIcons[typeCfg.type] ?? (
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    )}
                    <span className={count > 0 ? 'text-slate-200' : 'text-slate-500'}>
                      {typeCfg.label}
                    </span>
                  </span>
                  {count > 0 ? (
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${
                        isCritical
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {count}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] text-slate-600">—</span>
                  )}
                </div>
                {typeCfg.description ? (
                  <p className="line-clamp-2 pl-5 text-[10px] leading-snug text-slate-500">
                    {typeCfg.description}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
