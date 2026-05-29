'use client';

import { Loader2, Minus, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { scoreDisplayStyle } from '@/lib/school-intelligence/module-score-insights';
import { buildModuleObservationInsights } from '@/lib/school-intelligence/module-observation-insights';
import { scoreCompareLabel } from '@/lib/school-intelligence/date-range';
import type { SIObservation, SIStandardModuleConfig } from '@/lib/school-intelligence/module-standard/types';
import type { SIFilters } from '@/lib/school-intelligence/types';

type Props = {
  config: SIStandardModuleConfig;
  score: number | null;
  priorScore?: number | null;
  scoreDelta?: number | null;
  compareLabel?: string;
  filters: SIFilters;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  observations: SIObservation[];
  loading?: boolean;
};

export function SIModuleScorePanel({
  config,
  score,
  priorScore = null,
  scoreDelta = null,
  compareLabel,
  filters,
  periodStart,
  periodEnd,
  periodLabel,
  observations,
  loading,
}: Props) {
  const style = scoreDisplayStyle(score);
  const progress = score != null ? Math.min(100, Math.max(0, score)) : 0;
  const tips = buildModuleObservationInsights(score, observations, config);

  const DeltaIcon =
    scoreDelta != null && scoreDelta > 0
      ? TrendingUp
      : scoreDelta != null && scoreDelta < 0
        ? TrendingDown
        : Minus;
  const deltaTone =
    scoreDelta != null && scoreDelta > 0
      ? 'text-green-400'
      : scoreDelta != null && scoreDelta < 0
        ? 'text-red-400'
        : 'text-slate-500';

  const label =
    compareLabel ?? scoreCompareLabel(filters.dateRange, periodStart, periodEnd);

  return (
    <Card className={`h-full border ${style.border} ${style.bg}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-col gap-0.5 text-sm text-slate-200">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-sky-400" aria-hidden />
            {config.scoreTitle}
          </span>
          <span className="text-xs font-normal text-slate-500">{periodLabel}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex h-[calc(100%-3.5rem)] flex-col">
        {loading ? (
          <p className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading score…
          </p>
        ) : (
          <>
            <span
              className={`w-fit shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${style.badge}`}
            >
              {score == null
                ? 'No score'
                : score >= 85
                  ? 'Strong'
                  : score >= 70
                    ? 'Good'
                    : score >= 55
                      ? 'Watch'
                      : 'At risk'}
            </span>

            {(priorScore != null || label) && (
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                {priorScore != null && (
                  <span className="text-slate-500">
                    Previous:{' '}
                    <span className="tabular-nums font-medium text-slate-400">{priorScore}</span>
                  </span>
                )}
                {label && <span className="text-slate-600">{label}</span>}
              </div>
            )}

            <div className="mt-2 flex items-end gap-3">
              <p className={`text-5xl font-bold tabular-nums tracking-tight ${style.text}`}>
                {score ?? '—'}
              </p>
              <p className="mb-1.5 text-sm text-slate-500">/ 100</p>
              {scoreDelta != null && scoreDelta !== 0 && (
                <span
                  className={`mb-1.5 inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums ${deltaTone}`}
                >
                  <DeltaIcon className="h-4 w-4 shrink-0" aria-hidden />
                  {scoreDelta > 0 ? '+' : ''}
                  {scoreDelta}
                </span>
              )}
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800/90">
              <div
                className={`h-full rounded-full transition-all ${style.bar}`}
                style={{ width: score != null ? `${progress}%` : '0%' }}
              />
            </div>

            <div className="mt-5 flex-1 border-t border-slate-800/80 pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Score insights
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                Based on observed patterns — for awareness, not alert closure.
              </p>
              <ul className="mt-2.5 space-y-2.5">
                {tips.map((line, i) => (
                  <li
                    key={`tip-${i}`}
                    className="flex gap-2 text-xs leading-relaxed text-slate-300"
                  >
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/90"
                      aria-hidden
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
