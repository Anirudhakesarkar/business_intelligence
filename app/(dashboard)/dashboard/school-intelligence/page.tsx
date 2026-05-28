'use client';

import { useState } from 'react';
import Link from 'next/link';
import { todayIso, useSchoolDailyOverview } from '@/components/school-intelligence/useSchoolDailySummaries';
import { useSchoolOverallScore } from '@/components/school-intelligence/useSchoolScores';
import { SchoolCopilotPanel } from '@/components/school-intelligence/SchoolCopilotPanel';
import { SchoolCopilotQA } from '@/components/school-intelligence/SchoolCopilotQA';
import { SchoolRecommendationsStrip } from '@/components/school-intelligence/SchoolRecommendationsStrip';
import { GraduationCap, Gauge, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SIFilterBar } from '@/components/school-intelligence/SIFilterBar';
import { SIKPICard } from '@/components/school-intelligence/SIKPICard';
import { SIModuleHeader } from '@/components/school-intelligence/SIModuleHeader';
import { SIQuickLinks } from '@/components/school-intelligence/SIQuickLinks';
import { SISchoolContextBanner } from '@/components/school-intelligence/SISchoolContextBanner';
import type { SIFilters } from '@/lib/school-intelligence/types';
import { isMvp3ScoresOnlyClient, visibleScoreModuleKeysClient } from '@/components/school-intelligence/scoreVisibility';

const MODULE_KPIS = [
  { key: 'teacher', label: 'Teacher Productivity', mod: 'teacher' },
  { key: 'occupancy', label: 'Student Occupancy', mod: 'occupancy' },
  { key: 'academic', label: 'Academic Operations', mod: 'academic' },
  { key: 'staff', label: 'Staff Deployment', mod: 'staff' },
  { key: 'space', label: 'Space Utilization', mod: 'space' },
  { key: 'discipline', label: 'Discipline', mod: 'discipline' },
  { key: 'parent', label: 'Parent Experience', mod: 'parent' },
  { key: 'compliance', label: 'Compliance', mod: 'compliance' },
  { key: 'safety', label: 'Safety', mod: 'safety' },
  { key: 'security', label: 'Security', mod: 'security' },
];

export default function SchoolIntelligenceOverviewPage() {
  const [summaryDate, setSummaryDate] = useState(todayIso());
  const orgId = 1;
  const daily = useSchoolDailyOverview(orgId, summaryDate);
  const scores = useSchoolOverallScore(orgId, summaryDate);
  const [filters, setFilters] = useState<SIFilters>({ organizationId: '', siteId: '', dateRange: '7d' });
  const isSchoolOrg = filters.organizationId === '' || filters.organizationId === 'demo-school';

  function scoreFor(mod: string) {
    const m = scores.data?.moduleScores?.find((x) => x.moduleKey === mod);
    return m?.score != null ? String(m.score) : '—';
  }

  const mvp3Only = isMvp3ScoresOnlyClient();
  const visibleMods = new Set(visibleScoreModuleKeysClient());
  const primaryKpis = MODULE_KPIS.filter((k) => visibleMods.has(k.mod));
  const deferredKpis = MODULE_KPIS.filter((k) => !visibleMods.has(k.mod));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SIModuleHeader
          title="School Intelligence"
          description="Camera AI → signals → rules → daily facts → scores → GPT explanations."
          icon={<GraduationCap className="h-6 w-6" />}
        />
        <Button variant="outline" size="sm" className="w-fit border-slate-700 text-slate-300 hover:border-sky-600" onClick={() => { daily.reload(); scores.reload(); }}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <SIFilterBar filters={filters} onChange={setFilters} />
      {!isSchoolOrg && (
        <div className="rounded-lg border border-yellow-900/50 bg-yellow-950/30 px-4 py-3 text-sm text-yellow-200">
          School Intelligence is only available for school-type organizations.
        </div>
      )}
      {isSchoolOrg && <SISchoolContextBanner />}

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-slate-400">
          Summary date
          <input type="date" value={summaryDate} onChange={(e) => setSummaryDate(e.target.value)} className="ml-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100" />
        </label>
        <button type="button" className="text-xs text-sky-400 hover:underline" onClick={() => void fetch(`/api/school-intelligence/bootstrap?organizationId=${orgId}&date=${summaryDate}`, { method: 'POST' }).then(() => { daily.reload(); scores.reload(); })}>
          Bootstrap platform (Phases 1–6 E2E)
        </button>
        <Link href="/dashboard/school-intelligence/overall-score" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-sky-400">
          <Gauge className="h-3.5 w-3.5" /> Overall score detail
        </Link>
        <Link href="/dashboard/school-intelligence/actions" className="text-xs text-slate-400 hover:text-sky-400">
          Action tasks
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-sky-900/50 bg-slate-900 lg:col-span-1">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wider text-slate-500">Overall school score</p>
            <p className="mt-1 text-4xl font-semibold text-sky-300">{scores.data?.overallScore ?? '—'}</p>
            <p className="mt-1 text-xs text-slate-500">Phase 5 weighted · Safety 20% + Security 10%</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900 lg:col-span-1">
          <CardHeader className="pb-2 pt-6">
            <CardTitle className="text-sm font-medium text-slate-200">Daily facts preview</CardTitle>
            <p className="text-xs font-normal text-slate-500">
              Phase 4 summaries — narrative only (no KPI numbers here; module scores below are Phase 5).
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            {daily.loading && <p className="text-sm text-slate-500">Loading summaries…</p>}
            {daily.error && <p className="text-sm text-amber-200/90">{daily.error}</p>}
            {!daily.loading && !daily.error && daily.data && (
              <ul className="max-h-52 space-y-2 overflow-y-auto text-sm text-slate-300">
                {daily.data.modules
                  .flatMap((m) => m.facts.map((f) => ({ text: f.text, label: m.label })))
                  .filter((f) => f.text?.trim())
                  .slice(0, 10)
                  .map((f, i) => (
                    <li key={`${i}-${f.text.slice(0, 48)}`} className="border-b border-slate-800/80 pb-2 last:border-0 last:pb-0">
                      <span className="text-[10px] uppercase tracking-wide text-slate-500">{f.label}</span>
                      <p className="mt-0.5 text-slate-300">{f.text}</p>
                    </li>
                  ))}
              </ul>
            )}
            {!daily.loading && !daily.error && daily.data && daily.data.modules.every((m) => !m.facts.length) && (
              <p className="text-sm text-slate-500">No facts for this date yet. Run bootstrap or aggregate for the pipeline.</p>
            )}
          </CardContent>
        </Card>
        <div className="lg:col-span-1">
          <SchoolCopilotPanel organizationId={orgId} date={summaryDate} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SchoolCopilotQA organizationId={orgId} date={summaryDate} />
        <SchoolRecommendationsStrip organizationId={orgId} date={summaryDate} />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
          Module scores (Phase 5){mvp3Only ? ' · MVP3 priority' : ''}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {primaryKpis.map((kpi) => (
            <SIKPICard key={kpi.key} label={kpi.label} value={scoreFor(kpi.mod)} hint="Score / 100" />
          ))}
        </div>
        {mvp3Only && deferredKpis.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            More scores coming: {deferredKpis.map((k) => k.label).join(', ')} — enable full platform when ready.
          </p>
        )}
      </div>

      <SIQuickLinks />

      <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-5 py-4 text-sm">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Pipeline</p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
          {['Camera Stream', 'AI Detection', 'Raw Signals', 'Rule Engine', 'Daily Summary', 'Score Engine', 'GPT Copilot', 'Management Answer'].map((step, i, arr) => (
            <span key={step} className="flex items-center gap-1.5">
              <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-slate-300">{step}</span>
              {i < arr.length - 1 && <span className="text-slate-600">→</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
