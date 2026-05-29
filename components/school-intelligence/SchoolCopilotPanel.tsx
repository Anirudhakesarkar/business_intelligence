'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Sparkles, FileQuestion, ChevronDown } from 'lucide-react';
import { SISection } from '@/components/school-intelligence/SISection';
import { Button } from '@/components/ui/button';

type Summary = {
  content: string;
  citations: string[];
  createdAt: string;
};

export function SchoolCopilotPanel({ organizationId = 1, date }: { organizationId?: number; date: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/gpt/daily-summary?organizationId=${organizationId}&date=${encodeURIComponent(date)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load summary');
      setSummary(data.summary ?? null);
      if (!data.summary) setError(data.message ?? 'No summary yet');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [organizationId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  async function regenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/gpt/daily-summary/regenerate?organizationId=${organizationId}&date=${encodeURIComponent(date)}`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Regenerate failed');
      setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Regenerate failed');
    } finally {
      setRegenerating(false);
    }
  }

  async function seedFullPipeline() {
    setRegenerating(true);
    try {
      await fetch(`/api/school-intelligence/bootstrap?organizationId=${organizationId}&date=${encodeURIComponent(date)}`, {
        method: 'POST',
      });
      await load();
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <SISection
      icon={<Sparkles className="h-4 w-4 text-sky-300" />}
      eyebrow="Copilot · daily briefing"
      title="GPT Principal Summary"
      actions={
        <Button
          variant="outline"
          size="sm"
          className="h-8 border-slate-700 bg-slate-950/40 text-xs text-slate-300 hover:border-sky-500/40 hover:text-sky-200"
          disabled={regenerating}
          onClick={() => regenerate()}
        >
          {regenerating ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1.5 h-3 w-3" />}
          Regenerate
        </Button>
      }
    >
      <div className="space-y-3 text-sm text-slate-300">
        {loading && (
          <p className="flex items-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        )}
        {!loading && error && !summary && (
          <div className="space-y-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="flex items-start gap-2 text-amber-200">
              <FileQuestion className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-sky-500/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
              onClick={() => seedFullPipeline()}
            >
              Run full pipeline seed (Phases 1–6)
            </Button>
          </div>
        )}
        {summary && (
          <>
            <div className="prose prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
              {summary.content}
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-sky-300"
              onClick={() => setShowSources((s) => !s)}
            >
              <ChevronDown className={`h-3 w-3 transition-transform ${showSources ? 'rotate-180' : ''}`} />
              {showSources ? 'Hide' : 'Show'} data sources ({summary.citations.length})
            </button>
            {showSources && summary.citations.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {summary.citations.map((c) => (
                  <span
                    key={c}
                    className="rounded-md border border-slate-800 bg-slate-950/50 px-2 py-0.5 text-[11px] font-medium text-slate-300"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </SISection>
  );
}
