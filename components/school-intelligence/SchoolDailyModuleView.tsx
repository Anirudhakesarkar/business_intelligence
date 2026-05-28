'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';
import { SIPageShell } from '@/components/school-intelligence/SIPageShell';
import { SIKPICard } from '@/components/school-intelligence/SIKPICard';
import { SISection } from '@/components/school-intelligence/SISection';
import { SIDatePicker } from '@/components/school-intelligence/SIDatePicker';
import { SIDailyTrendCard } from '@/components/school-intelligence/SIDailyTrendCard';
import {
  eventsDrilldownHref,
  todayIso,
  useSchoolDailyModule,
} from '@/components/school-intelligence/useSchoolDailySummaries';
import type { DailySummaryModule } from '@/lib/school-daily-summaries/types';
import { DAILY_TO_SCORE_MODULE } from '@/components/school-intelligence/moduleScoreMap';
import { useSchoolModuleScore } from '@/components/school-intelligence/useSchoolModuleScore';
import { MODULE_TREND_METRIC } from '@/components/school-intelligence/moduleTrendMetrics';

type Tone = 'sky' | 'indigo' | 'violet' | 'emerald' | 'amber' | 'rose' | 'slate';

type Props = {
  module: DailySummaryModule;
  title: string;
  description: string;
  icon: React.ReactNode;
  tone?: Tone;
  kpiKeys?: { key: string; label: string; format?: (v: number | string | null) => string }[];
  secondaryModule?: DailySummaryModule;
  /** Optional extra content rendered below the "What happened today" card. */
  extra?: (date: string, orgId: number) => React.ReactNode;
};

function fmtPct(v: number | string | null) {
  if (v == null) return '—';
  if (typeof v === 'string') return v;
  return `${v}%`;
}

function scoreTone(score: number | null): { value: 'success' | 'info' | 'warning' | 'danger'; label: string } {
  if (score == null) return { value: 'info', label: '—' };
  if (score >= 85) return { value: 'success', label: 'Strong' };
  if (score >= 70) return { value: 'info', label: 'Steady' };
  if (score >= 55) return { value: 'warning', label: 'Watch' };
  return { value: 'danger', label: 'Action needed' };
}

export function SchoolDailyModuleView({
  module,
  title,
  description,
  icon,
  tone = 'sky',
  kpiKeys,
  secondaryModule,
  extra,
}: Props) {
  const [date, setDate] = useState(todayIso());
  const orgId = 1;
  const [foundationReady, setFoundationReady] = useState<boolean | null>(null);
  const [aggregating, setAggregating] = useState(false);
  const [aggregateNote, setAggregateNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/school-management/setup-health?organizationId=${orgId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((h: { timetableEntries?: number; rosterEntries?: number } | null) => {
        if (!cancelled && h) {
          setFoundationReady((h.timetableEntries ?? 0) > 0 && (h.rosterEntries ?? 0) > 0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);
  const scoreKey = DAILY_TO_SCORE_MODULE[module];
  const scores = useSchoolModuleScore(scoreKey, orgId, date);
  const primary = useSchoolDailyModule(module, orgId, date);
  // Only fetch secondary when explicitly provided — avoid duplicate request to the same module.
  const secondary = useSchoolDailyModule(secondaryModule ?? module, orgId, date);
  const loading = primary.loading || (secondaryModule ? secondary.loading : false);
  const data = primary.data;
  const metrics = data?.headlineMetrics ?? {};
  const facts = [
    ...(data?.facts ?? []),
    ...(secondaryModule && secondary.data?.facts ? secondary.data.facts.slice(0, 2) : []),
  ];
  const defaultKpis =
    kpiKeys ??
    Object.entries(metrics)
      .slice(0, 4)
      .map(([key, val]) => ({
        key,
        label: key.replace(/_/g, ' '),
        format: (v: number | string | null) => (typeof v === 'number' && key.includes('pct') ? fmtPct(v) : String(v ?? '—')),
      }));

  const st = scoreTone(scores.score);

  const runAggregation = async () => {
    setAggregating(true);
    setAggregateNote(null);
    try {
      const res = await fetch(
        `/api/school-daily-summaries/aggregate?organizationId=${orgId}&date=${encodeURIComponent(date)}`,
        { method: 'POST' },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      if (body.skipped && body.reason === 'holiday') {
        setAggregateNote('This date is marked as a holiday — no daily summary was generated.');
      } else {
        setAggregateNote(null);
      }
      await primary.reload();
      if (secondaryModule) await secondary.reload();
    } catch (e) {
      setAggregateNote(e instanceof Error ? e.message : 'Aggregation failed');
    } finally {
      setAggregating(false);
    }
  };

  useEffect(() => {
    setAggregateNote(null);
  }, [date, module]);

  return (
    <SIPageShell
      title={title}
      description={description}
      icon={icon}
      tone={tone}
      actions={<SIDatePicker value={date} onChange={setDate} />}
    >
      {scoreKey && (
        <SISection
          eyebrow="Phase 5 module score"
          title={
            <span className="flex items-baseline gap-3">
              <span className="text-3xl font-semibold tracking-tight text-slate-50">
                {scores.loading ? '…' : scores.score ?? '—'}
              </span>
              <span className="text-xs text-slate-400">/100</span>
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  st.value === 'success'
                    ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30'
                    : st.value === 'warning'
                    ? 'bg-amber-500/10 text-amber-300 ring-amber-500/30'
                    : st.value === 'danger'
                    ? 'bg-rose-500/10 text-rose-300 ring-rose-500/30'
                    : 'bg-sky-500/10 text-sky-300 ring-sky-500/30'
                }`}
              >
                {st.label}
              </span>
            </span>
          }
          description={
            scores.delta != null
              ? (scores.delta >= 0 ? '+' : '') + scores.delta + ' vs prior school day'
              : 'Score reflects weighted drivers from the Phase 4 daily summary.'
          }
          actions={
            scores.trend.length > 1 ? (
              <div className="flex h-9 items-end gap-0.5">
                {scores.trend.map((p) => (
                  <div
                    key={p.date}
                    title={`${p.date}: ${p.score}`}
                    className="w-1.5 rounded-t bg-sky-500/70"
                    style={{ height: `${Math.max(8, p.score)}%` }}
                  />
                ))}
              </div>
            ) : null
          }
        >
          {scores.drivers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {scores.drivers.slice(0, 6).map((d) => (
                <Link
                  key={d.key}
                  href={d.metricKey ? eventsDrilldownHref(module, date, d.metricKey) : eventsDrilldownHref(module, date)}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-950/40 px-3 py-1 text-xs text-slate-300 transition-colors hover:border-sky-500/30 hover:bg-sky-500/10 hover:text-sky-200"
                >
                  {d.label}
                  <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          )}
        </SISection>
      )}

      {loading && (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading daily summary…
        </p>
      )}

      {primary.error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p>{primary.error}.</p>
            <button
              type="button"
              className="mt-1 inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-100 hover:bg-rose-500/20"
              onClick={() => void fetch('/api/school-daily-summaries/seed', { method: 'POST' }).then(() => primary.reload())}
            >
              Seed pipeline with demo data
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {defaultKpis.map((k) => (
          <SIKPICard
            key={k.key}
            label={k.label}
            value={k.format ? k.format(metrics[k.key] ?? null) : String(metrics[k.key] ?? '—')}
            hint="Daily summary"
          />
        ))}
      </div>

      <SIDailyTrendCard module={module} date={date} organizationId={orgId} metricKey={MODULE_TREND_METRIC[module]} />

      <SISection
        icon={<Sparkles className="h-4 w-4" />}
        title="What happened today"
        description="Plain-language facts derived from the Phase 4 summary."
      >
        {facts.length === 0 && !loading && !primary.error && (
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-400">
            <p>No summary facts for {date} yet.</p>
            {foundationReady === true && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={aggregating}
                  onClick={() => void runAggregation()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-200 hover:bg-sky-500/20 disabled:opacity-50"
                >
                  {aggregating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Aggregating…
                    </>
                  ) : (
                    `Generate summary for ${date}`
                  )}
                </button>
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:text-slate-300"
                  onClick={() =>
                    void fetch('/api/school-daily-summaries/seed', { method: 'POST' }).then(() => primary.reload())
                  }
                >
                  Or seed demo pipeline
                </button>
              </div>
            )}
            {foundationReady === false && (
              <p className="mt-2 text-xs text-slate-500">
                Complete School Management setup (timetable and staff duty) before daily modules can show live periods and shifts.
              </p>
            )}
            {aggregateNote && <p className="mt-2 text-xs text-amber-300/90">{aggregateNote}</p>}
          </div>
        )}
        <ul className="space-y-3">
          {facts.map((f, i) => (
            <li
              key={`${f.text}-${i}`}
              className="flex flex-col gap-1 rounded-lg border border-slate-800/60 bg-slate-950/30 px-3 py-2.5"
            >
              <p className="text-sm leading-relaxed text-slate-200">{f.text}</p>
              {(f.metricKey || f.eventTypes?.length) && (
                <Link
                  href={eventsDrilldownHref(module, date, f.metricKey, f.eventTypes as never)}
                  className="inline-flex w-fit items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300"
                >
                  View related events <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </SISection>

      {extra?.(date, orgId)}
    </SIPageShell>
  );
}
