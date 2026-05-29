'use client';

import { Loader2, Minus, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { scoreDisplayStyle } from '@/lib/school-intelligence/module-score-insights';
import { buildSafetyImprovementTips } from '@/lib/school-intelligence/safety-improvement-tips';
import type { ModuleScoreCompare } from '@/lib/school-intelligence/module-score-demo';
import { scoreCompareLabel } from '@/lib/school-intelligence/date-range';
import type { SIFilters } from '@/lib/school-intelligence/types';

type SafetyEventLike = {
  eventType: string;
  severity: string;
  status: string;
  evidence?: { summary?: string };
};

type Props = {
  overallScore: number | null;
  moduleCompare?: ModuleScoreCompare[];
  compareLabel?: string;
  filters: SIFilters;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  events: SafetyEventLike[];
  loading?: boolean;
};

function overallPriorFromModules(
  overallCurrent: number | null,
  moduleDeltas: ModuleScoreCompare[],
): { prior: number | null; delta: number | null } {
  const priors = moduleDeltas.map((m) => m.prior).filter((p): p is number => p != null);
  if (overallCurrent == null || priors.length === 0) {
    return { prior: null, delta: null };
  }
  const prior = Math.round(priors.reduce((a, b) => a + b, 0) / priors.length);
  return { prior, delta: overallCurrent - prior };
}

export function CampusSafetyScorePanel({
  overallScore,
  moduleCompare = [],
  compareLabel,
  filters,
  periodStart,
  periodEnd,
  periodLabel,
  events,
  loading,
}: Props) {
  const style = scoreDisplayStyle(overallScore);
  const progress = overallScore != null ? Math.min(100, Math.max(0, overallScore)) : 0;
  const { prior, delta } = overallPriorFromModules(overallScore, moduleCompare);
  const safetyRow = moduleCompare.find((m) => m.moduleKey === 'safety');
  const tips = buildSafetyImprovementTips(safetyRow?.current ?? overallScore, events);

  const DeltaIcon =
    delta != null && delta > 0 ? TrendingUp : delta != null && delta < 0 ? TrendingDown : Minus;
  const deltaTone =
    delta != null && delta > 0
      ? 'text-green-400'
      : delta != null && delta < 0
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
            Overall score
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
            <div className="flex items-start justify-between gap-2">
              <span
                className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${style.badge}`}
              >
                {overallScore == null
                  ? 'No score'
                  : overallScore >= 85
                    ? 'Strong'
                    : overallScore >= 70
                      ? 'Good'
                      : overallScore >= 55
                        ? 'Watch'
                        : 'At risk'}
              </span>
              {safetyRow?.current != null && (
                <p className="text-right text-[10px] text-slate-500">
                  Safety module{' '}
                  <span className="font-semibold tabular-nums text-slate-300">{safetyRow.current}</span>
                  /100
                </p>
              )}
            </div>

            {(prior != null || label) && (
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                {prior != null && (
                  <span className="text-slate-500">
                    Previous:{' '}
                    <span className="tabular-nums font-medium text-slate-400">{prior}</span>
                  </span>
                )}
                {label && <span className="text-slate-600">{label}</span>}
              </div>
            )}

            <div className="mt-2 flex items-end gap-3">
              <p className={`text-5xl font-bold tabular-nums tracking-tight ${style.text}`}>
                {overallScore ?? '—'}
              </p>
              <p className="mb-1.5 text-sm text-slate-500">/ 100</p>
              {delta != null && delta !== 0 && (
                <span
                  className={`mb-1.5 inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums ${deltaTone}`}
                >
                  <DeltaIcon className="h-4 w-4 shrink-0" aria-hidden />
                  {delta > 0 ? '+' : ''}
                  {delta}
                </span>
              )}
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800/90">
              <div
                className={`h-full rounded-full transition-all ${style.bar}`}
                style={{ width: overallScore != null ? `${progress}%` : '0%' }}
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
