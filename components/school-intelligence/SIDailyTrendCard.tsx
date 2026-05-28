'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, TrendingDown, TrendingUp, Minus, LineChart as LineChartIcon } from 'lucide-react';
import { SISection } from '@/components/school-intelligence/SISection';
import type { DailySummaryModule } from '@/lib/school-daily-summaries/types';
import { MODULE_TREND_METRIC } from '@/components/school-intelligence/moduleTrendMetrics';

type TrendPoint = { date: string; value: number | null };

type WeekCompare = {
  metricKey: string;
  thisWeek: { total: number; average: number | null };
  lastWeek: { total: number; average: number | null };
  delta: number;
};

type Props = {
  module: DailySummaryModule;
  date: string;
  organizationId?: number;
  metricKey?: string;
};

function MiniSparkArea({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-slate-600">
        Not enough data points to chart.
      </div>
    );
  }
  const values = points.map((p) => p.value ?? 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const w = 600;
  const h = 96;
  const step = w / (points.length - 1);
  const ptsXY = points.map((p, i) => {
    const x = i * step;
    const y = h - ((p.value ?? 0) - min) / range * h;
    return [x, y] as const;
  });
  const linePath = ptsXY.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full overflow-visible">
      <defs>
        <linearGradient id="si-trend-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#si-trend-grad)" />
      <path d={linePath} fill="none" stroke="#38bdf8" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      {ptsXY.map(([x, y], i) => (
        <g key={points[i].date}>
          <circle cx={x} cy={y} r={2.5} fill="#0ea5e9" stroke="#020617" strokeWidth={1.5} />
          <title>{`${points[i].date}: ${points[i].value ?? '—'}`}</title>
        </g>
      ))}
    </svg>
  );
}

export function SIDailyTrendCard({ module, date, organizationId = 1, metricKey }: Props) {
  const metric = metricKey ?? MODULE_TREND_METRIC[module];
  const [days, setDays] = useState<7 | 30>(7);
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [compare, setCompare] = useState<WeekCompare | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!metric) {
      setPoints([]);
      setCompare(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = new URLSearchParams({
        organizationId: String(organizationId),
        date,
        days: String(days),
        metric,
      });
      const [trendRes, compareRes] = await Promise.all([
        fetch(`/api/daily-summaries/${module}/trend?${q}`),
        fetch(`/api/daily-summaries/${module}/compare?${q}`),
      ]);
      if (trendRes.ok) {
        const t = await trendRes.json();
        setPoints(t.points ?? []);
      }
      if (compareRes.ok) {
        setCompare(await compareRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, [module, date, organizationId, days, metric]);

  useEffect(() => {
    void load();
  }, [load]);

  const DeltaIcon = compare && compare.delta > 0 ? TrendingUp : compare && compare.delta < 0 ? TrendingDown : Minus;
  const deltaCls =
    !compare || compare.delta === 0
      ? 'text-slate-400'
      : compare.delta > 0
      ? 'text-amber-400'
      : 'text-emerald-400';

  return (
    <SISection
      icon={<LineChartIcon className="h-4 w-4" />}
      title="Daily trend"
      description={metric ? metric.replace(/_/g, ' ') : 'No default metric for this module.'}
      actions={
        <div className="inline-flex overflow-hidden rounded-md border border-slate-800 bg-slate-950/40">
          {([7, 30] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                days === d ? 'bg-sky-500/15 text-sky-200' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-4">
        {loading && (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading trend…
          </p>
        )}
        {!loading && metric && points.length > 0 && <MiniSparkArea points={points} />}
        {!loading && metric && points.length === 0 && (
          <p className="text-sm text-slate-500">No data points returned for this metric yet.</p>
        )}
        {!loading && compare && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs">
            <div className="text-slate-400">
              <p className="font-medium text-slate-300">This week vs last week</p>
              <p className="mt-0.5 text-slate-500">
                {compare.thisWeek.total} this week · {compare.lastWeek.total} last week
              </p>
            </div>
            <span className={`inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-1 text-xs font-medium ring-1 ring-inset ring-slate-800 ${deltaCls}`}>
              <DeltaIcon className="h-3 w-3" />
              {compare.delta > 0 ? '+' : ''}{compare.delta}
            </span>
          </div>
        )}
      </div>
    </SISection>
  );
}
