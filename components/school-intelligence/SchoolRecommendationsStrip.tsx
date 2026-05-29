'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ListChecks, CheckCircle2, AlertTriangle } from 'lucide-react';
import { SISection } from '@/components/school-intelligence/SISection';
import { Button } from '@/components/ui/button';

type Rec = {
  id: number;
  priority: string;
  moduleKey: string;
  title: string;
  rationale: string;
  suggestedAction: string;
  expectedImpact?: string;
};

const PRIORITY_BADGE: Record<string, string> = {
  high: 'bg-rose-500/10 text-rose-300 ring-rose-500/30',
  medium: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
  low: 'bg-slate-700/40 text-slate-300 ring-slate-600/40',
};

export function SchoolRecommendationsStrip({ organizationId = 1, date }: { organizationId?: number; date: string }) {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState<number | null>(null);
  const [createdIds, setCreatedIds] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gpt/recommendations?organizationId=${organizationId}&date=${encodeURIComponent(date)}`);
      const data = await res.json();
      setRecs(data.recommendations ?? []);
    } finally {
      setLoading(false);
    }
  }, [organizationId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function createAction(recommendationId: number) {
    setCreatingId(recommendationId);
    try {
      const res = await fetch('/api/gpt/actions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organizationId, recommendationId, assignee: 'Duty Manager' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCreatedIds((prev) => new Set(prev).add(recommendationId));
      setToast({ kind: 'ok', msg: 'Action created.' });
    } catch (e) {
      setToast({ kind: 'err', msg: e instanceof Error ? e.message : 'Could not create action.' });
    } finally {
      setCreatingId(null);
    }
  }

  return (
    <SISection
      icon={<ListChecks className="h-4 w-4" />}
      eyebrow="Copilot · recommendations"
      title="Recommendations"
    >
      {toast && (
        <div
          className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
            toast.kind === 'ok'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/20 bg-rose-500/10 text-rose-200'
          }`}
        >
          {toast.kind === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          {toast.msg}
        </div>
      )}
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : recs.length === 0 ? (
        <p className="text-sm text-slate-500">
          No recommendations yet. Regenerate the daily summary after scores exist.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {recs.map((r) => {
            const created = createdIds.has(r.id);
            return (
              <li
                key={r.id}
                className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5 transition-colors hover:border-slate-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-slate-100">{r.title}</p>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${PRIORITY_BADGE[r.priority] ?? PRIORITY_BADGE.low}`}
                  >
                    {r.priority}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{r.rationale}</p>
                <p className="mt-1.5 text-xs text-sky-300/90">→ {r.suggestedAction}</p>
                <div className="mt-2.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={created || creatingId === r.id}
                    className="h-7 border-slate-700 bg-slate-900/60 text-xs hover:border-sky-500/40 hover:text-sky-200 disabled:opacity-60"
                    onClick={() => createAction(r.id)}
                  >
                    {creatingId === r.id ? (
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    ) : created ? (
                      <CheckCircle2 className="mr-1.5 h-3 w-3 text-emerald-400" />
                    ) : null}
                    {created ? 'Action created' : creatingId === r.id ? 'Creating…' : 'Create action'}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SISection>
  );
}
