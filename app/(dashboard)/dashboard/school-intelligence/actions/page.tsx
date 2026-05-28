'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, RefreshCw, User, Calendar, TrendingUp, Clock, ListChecks } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SIModuleHeader } from '@/components/school-intelligence/SIModuleHeader';

type Action = {
  id: number;
  title: string;
  status: 'open' | 'completed' | 'dismissed';
  assignee?: string;
  summaryDate: string;
  completedAt?: string;
  recommendationId?: number;
};

const STATUS_TABS = ['all', 'open', 'completed'] as const;
type StatusTab = typeof STATUS_TABS[number];

const STATUS_CONFIG = {
  open: { cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30', label: 'Open' },
  completed: { cls: 'bg-green-500/10 text-green-400 border-green-500/30', label: 'Completed' },
  dismissed: { cls: 'bg-slate-700 text-slate-400 border-slate-600', label: 'Dismissed' },
};

export default function SchoolActionsPage() {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [impact, setImpact] = useState<Record<number, { delta: number; label: string }>>({});
  const [completing, setCompleting] = useState<number | null>(null);
  const [statusTab, setStatusTab] = useState<StatusTab>('open');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gpt/actions?organizationId=1');
      const data = await res.json();
      setActions(data.actions ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function complete(id: number) {
    setCompleting(id);
    try {
      await fetch(`/api/gpt/actions/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organizationId: 1, status: 'completed' }),
      });
      const impRes = await fetch(`/api/gpt/actions/${id}/impact?organizationId=1`);
      const impData = await impRes.json();
      if (impData.delta?.overall != null) {
        const delta = impData.delta.overall;
        setImpact((p) => ({ ...p, [id]: { delta, label: `Score Δ ${delta >= 0 ? '+' : ''}${delta}` } }));
      }
      await load();
    } finally {
      setCompleting(null);
    }
  }

  const filtered = actions.filter((a) => statusTab === 'all' || a.status === statusTab);

  const openCount = actions.filter((a) => a.status === 'open').length;
  const completedCount = actions.filter((a) => a.status === 'completed').length;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/school-intelligence" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-sky-400">
        <ArrowLeft className="h-4 w-4" /> Back to School Intelligence
      </Link>

      <div className="flex items-start justify-between gap-4">
        <SIModuleHeader
          title="GPT Action Tasks"
          description="Recommended actions generated from GPT recommendations — complete tasks to improve school scores."
          icon={<ListChecks className="h-6 w-6" />}
        />
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className="mr-1 h-3 w-3" /> Refresh
        </Button>
      </div>

      {/* Summary cards */}
      {actions.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card className="border-amber-900/40 bg-amber-950/10">
            <CardContent className="p-3">
              <p className="text-xs text-amber-500">Open tasks</p>
              <p className="text-2xl font-bold text-amber-300">{openCount}</p>
            </CardContent>
          </Card>
          <Card className="border-green-900/40 bg-green-950/10">
            <CardContent className="p-3">
              <p className="text-xs text-green-500">Completed</p>
              <p className="text-2xl font-bold text-green-300">{completedCount}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900/50">
            <CardContent className="p-3">
              <p className="text-xs text-slate-500">Total</p>
              <p className="text-2xl font-bold text-slate-200">{actions.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900/40 p-1 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusTab(tab)}
            className={`rounded-md px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
              statusTab === tab ? 'bg-sky-700 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab}
            {tab !== 'all' && (
              <span className="ml-1.5 rounded-full bg-slate-700/60 px-1.5 text-slate-300">
                {tab === 'open' ? openCount : completedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading actions…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center">
          <ListChecks className="mx-auto mb-2 h-8 w-8 text-slate-600" />
          <p className="text-sm text-slate-500">
            {statusTab === 'open'
              ? 'No open tasks. Create from recommendations on the Overview or Digest page.'
              : `No ${statusTab} tasks.`}
          </p>
          {statusTab === 'open' && (
            <Link href="/dashboard/school-intelligence/digest" className="mt-2 inline-block text-xs text-sky-400 hover:underline">
              Go to digest & recommendations →
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((a) => {
            const statusCfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.open;
            const imp = impact[a.id];
            return (
              <Card
                key={a.id}
                className={`border ${a.status === 'open' ? 'border-amber-900/30 bg-amber-950/5' : a.status === 'completed' ? 'border-green-900/30 bg-green-950/5' : 'border-slate-800 bg-slate-900/50'}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-sm text-slate-200 leading-snug">{a.title}</CardTitle>
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium ${statusCfg.cls}`}>
                      {statusCfg.label}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {a.summaryDate}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" /> {a.assignee ?? 'Unassigned'}
                    </span>
                    {a.completedAt && (
                      <span className="flex items-center gap-1 text-green-500">
                        <Clock className="h-3 w-3" /> Completed {new Date(a.completedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Impact display */}
                  {imp && (
                    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${imp.delta >= 0 ? 'border-green-800/40 bg-green-950/20 text-green-300' : 'border-red-800/40 bg-red-950/20 text-red-300'}`}>
                      <TrendingUp className="h-4 w-4" />
                      <span className="font-medium">{imp.label}</span>
                    </div>
                  )}

                  {a.status === 'open' && (
                    <Button
                      size="sm"
                      className="bg-green-700 hover:bg-green-600"
                      disabled={completing === a.id}
                      onClick={() => complete(a.id)}
                    >
                      {completing === a.id ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                      )}
                      {completing === a.id ? 'Completing…' : 'Mark complete'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
