'use client';

import { CheckCircle2, Eye, Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type SafetyObservation = {
  id: number;
  eventType: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  startedAt: string;
  evidence: { summary: string };
  cameraId?: number;
};

const SEVERITY_COLORS: Record<string, string> = {
  Critical: 'text-red-400 bg-red-500/10 border-red-500/30',
  High: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  Low: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
};

const SEVERITY_DOT: Record<string, string> = {
  Critical: 'bg-red-500',
  High: 'bg-orange-500',
  Medium: 'bg-amber-500',
  Low: 'bg-blue-400',
};

const SEVERITY_ICON_BG: Record<string, string> = {
  Critical: 'bg-red-500/10 ring-red-500/20',
  High: 'bg-orange-500/10 ring-orange-500/20',
  Medium: 'bg-amber-500/10 ring-amber-500/20',
  Low: 'bg-blue-500/10 ring-blue-500/20',
};

function humanizeEventType(type: string): string {
  return type.replace(/([A-Z])/g, ' $1').trim();
}

function formatEventTime(iso: string): { time: string; date: string } {
  const d = new Date(iso);
  return {
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };
}

export type ObservationFilter = 'priority' | 'all';

type Props = {
  observations: SafetyObservation[];
  loading: boolean;
  filter: ObservationFilter;
  onFilterChange: (f: ObservationFilter) => void;
  eventIcons: Record<string, React.ReactNode>;
  eventLabels?: Record<string, string>;
  periodLabel: string;
};

export function SafetyEventFeed({
  observations,
  loading,
  filter,
  onFilterChange,
  eventIcons,
  eventLabels,
  periodLabel,
}: Props) {
  const labelFor = (type: string) => eventLabels?.[type] ?? humanizeEventType(type);
  const priorityCount = observations.filter(
    (o) => o.severity === 'Critical' || o.severity === 'High',
  ).length;

  return (
    <Card className="flex h-full flex-col border-slate-800 bg-slate-900/60">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Eye className="h-4 w-4 text-sky-400" aria-hidden />
              Safety observations
            </CardTitle>
            <p className="mt-0.5 text-xs text-slate-500">
              {loading
                ? 'Loading…'
                : `${observations.length} in view · ${priorityCount} high priority · ${periodLabel}`}
            </p>
          </div>
          <div
            className="flex rounded-lg border border-slate-700/80 bg-slate-950/50 p-0.5 text-xs"
            role="tablist"
            aria-label="Observation filter"
          >
            {(
              [
                { id: 'priority' as const, label: 'Priority' },
                { id: 'all' as const, label: 'All' },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                onClick={() => onFilterChange(id)}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  filter === id
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col pt-0">
        {loading ? (
          <p className="flex flex-1 items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading observations…
          </p>
        ) : observations.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/80 bg-slate-950/30 px-6 py-10 text-center">
            <CheckCircle2 className="mb-2 h-8 w-8 text-green-600" />
            <p className="text-sm text-slate-400">
              No {filter === 'priority' ? 'priority ' : ''}observations for {periodLabel}.
            </p>
            <p className="mt-1 text-xs text-slate-600">
              AI-detected patterns appear here for awareness — no action required on this page.
            </p>
          </div>
        ) : (
          <ul className="max-h-[min(32rem,70vh)] space-y-2 overflow-y-auto pr-1">
            {observations.map((o) => {
              const { time, date } = formatEventTime(o.startedAt);
              return (
                <li key={o.id}>
                  <article
                    className="flex gap-3 rounded-xl border border-slate-800/90 bg-slate-950/40 p-3"
                    aria-label={`${labelFor(o.eventType)} observation`}
                  >
                    <div className="flex w-12 shrink-0 flex-col items-center border-r border-slate-800/80 pr-3 text-center">
                      <span className="text-xs font-semibold tabular-nums text-slate-300">{time}</span>
                      <span className="mt-0.5 text-[9px] text-slate-600">{date}</span>
                    </div>

                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${SEVERITY_ICON_BG[o.severity] ?? 'bg-slate-800/80 ring-slate-700/60'}`}
                    >
                      {eventIcons[o.eventType] ?? (
                        <ShieldAlert className="h-4 w-4 text-slate-400" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-100">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[o.severity] ?? 'bg-slate-500'}`}
                            aria-hidden
                          />
                          {labelFor(o.eventType)}
                        </span>
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${SEVERITY_COLORS[o.severity] ?? ''}`}
                        >
                          {o.severity}
                        </span>
                        <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-500 ring-1 ring-inset ring-slate-700/60">
                          Observed
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">
                        {o.evidence?.summary}
                      </p>
                      {o.cameraId != null && (
                        <p className="mt-1.5 text-[10px] text-slate-600">Camera #{o.cameraId}</p>
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
