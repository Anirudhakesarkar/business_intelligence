'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Calendar, Gauge, Loader2, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SIModuleHeader } from '@/components/school-intelligence/SIModuleHeader';
import { todayIso, useSchoolDailyModule } from '@/components/school-intelligence/useSchoolDailySummaries';
import { useSchoolOverallScore } from '@/components/school-intelligence/useSchoolScores';
import { MODULE_LABELS } from '@/lib/school-score-engine/weights';
import type { ScoreModuleKey } from '@/lib/school-score-engine/types';
import { isMvp3ScoresOnlyClient, visibleScoreModuleKeysClient } from '@/components/school-intelligence/scoreVisibility';

// Module → page route mapping
const MODULE_HREFS: Record<string, string> = {
  safety: '/dashboard/school-intelligence/campus-safety',
  security: '/dashboard/school-intelligence/campus-safety',
  teacher: '/dashboard/school-intelligence/teacher-productivity',
  occupancy: '/dashboard/school-intelligence/student-occupancy',
  academic: '/dashboard/school-intelligence/academic-operations',
  staff: '/dashboard/school-intelligence/staff-deployment',
  space: '/dashboard/school-intelligence/space-utilization',
  discipline: '/dashboard/school-intelligence/discipline',
  parent: '/dashboard/school-intelligence/parent-experience',
  compliance: '/dashboard/school-intelligence/compliance',
};

function scoreColor(score: number): { text: string; bar: string; border: string; bg: string } {
  if (score >= 85) return { text: 'text-green-300', bar: 'bg-green-500', border: 'border-green-800/50', bg: 'bg-green-950/15' };
  if (score >= 70) return { text: 'text-sky-300', bar: 'bg-sky-500', border: 'border-sky-800/50', bg: 'bg-sky-950/15' };
  if (score >= 55) return { text: 'text-amber-300', bar: 'bg-amber-500', border: 'border-amber-800/50', bg: 'bg-amber-950/15' };
  return { text: 'text-red-300', bar: 'bg-red-500', border: 'border-red-800/50', bg: 'bg-red-950/15' };
}

function overallGrade(score: number): { label: string; cls: string } {
  if (score >= 90) return { label: 'Excellent', cls: 'text-green-300' };
  if (score >= 80) return { label: 'Good', cls: 'text-sky-300' };
  if (score >= 70) return { label: 'Satisfactory', cls: 'text-blue-300' };
  if (score >= 60) return { label: 'Needs Attention', cls: 'text-amber-300' };
  return { label: 'Critical', cls: 'text-red-300' };
}

export default function OverallScorePage() {
  const [date, setDate] = useState(todayIso());
  const [calculating, setCalculating] = useState(false);
  const orgId = 1;
  const { data: facts, loading: factsLoading } = useSchoolDailyModule('school', orgId, date);
  const { data: scores, loading: scoresLoading, error, reload } = useSchoolOverallScore(orgId, date);
  const row = facts?.rows?.[0] as { inputsJson?: Record<string, unknown> } | undefined;
  const loading = factsLoading || scoresLoading;

  async function runCalculate() {
    setCalculating(true);
    try {
      await fetch(`/api/school-scores/calculate?organizationId=${orgId}&date=${date}`, { method: 'POST' });
      reload();
    } finally {
      setCalculating(false);
    }
  }

  const modules = scores?.moduleScores ?? [];
  const overall = scores?.overallScore;
  const grade = overall != null ? overallGrade(overall) : null;

  const mvp3Only = isMvp3ScoresOnlyClient();
  const visible = new Set(visibleScoreModuleKeysClient());
  const sortedModules = [...modules].filter((m) => visible.has(m.moduleKey)).sort((a, b) => a.score - b.score);
  const hiddenCount = modules.length - sortedModules.length;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/school-intelligence" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-sky-400">
        <ArrowLeft className="h-4 w-4" /> Back to School Intelligence
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SIModuleHeader
          title="Overall School Score"
          description="Weighted composite: Safety 20% · Security 10% · eight intelligence modules 70%."
          icon={<Gauge className="h-6 w-6" />}
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <Calendar className="h-4 w-4" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
            />
          </label>
          <Button size="sm" onClick={runCalculate} disabled={calculating} className="bg-sky-700 hover:bg-sky-600">
            {calculating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
            Calculate
          </Button>
        </div>
      </div>

      {/* Overall score hero */}
      <Card className={`border ${overall != null ? scoreColor(overall).border + ' ' + scoreColor(overall).bg : 'border-slate-800 bg-slate-900'}`}>
        <CardContent className="p-6">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading scores…
            </p>
          ) : error ? (
            <p className="text-sm text-red-300">{error}</p>
          ) : overall != null ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Overall School Score</p>
                <div className="flex items-end gap-3">
                  <p className={`text-6xl font-bold ${scoreColor(overall).text}`}>{overall}</p>
                  <p className="mb-1 text-2xl text-slate-500">/100</p>
                </div>
                {grade && <p className={`text-sm font-medium ${grade.cls}`}>{grade.label}</p>}
                <p className="mt-1 text-xs text-slate-600">Weight profile #{scores?.weightProfileId}</p>
              </div>

              {/* Radial hint */}
              <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                <svg className="h-24 w-24 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#1e293b" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.5" fill="none"
                    stroke={overall >= 80 ? '#22c55e' : overall >= 60 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="3"
                    strokeDasharray={`${overall * 0.974} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-lg font-bold text-slate-200">{overall}</span>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-3xl font-semibold text-slate-500">—</p>
              <p className="mt-1 text-xs text-slate-500">No scores yet. Seed Phase 4 data, then click Calculate.</p>
              <Button size="sm" className="mt-3 bg-sky-700 hover:bg-sky-600" onClick={runCalculate} disabled={calculating}>
                {calculating ? 'Calculating…' : 'Calculate now'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Module score grid */}
      {sortedModules.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
            Module Breakdown (worst → best){mvp3Only ? ' · MVP3' : ''}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedModules.map((m) => {
              const col = scoreColor(m.score);
              const weight = scores?.weights?.[m.moduleKey as ScoreModuleKey];
              const href = MODULE_HREFS[m.moduleKey] ?? '/dashboard/school-intelligence';
              return (
                <Link key={m.moduleKey} href={`${href}?date=${date}`}>
                  <Card className={`border ${col.border} ${col.bg} cursor-pointer transition-all hover:brightness-110`}>
                    <CardHeader className="pb-1">
                      <CardTitle className="flex items-center justify-between text-xs text-slate-400">
                        <span>{MODULE_LABELS[m.moduleKey as ScoreModuleKey]}</span>
                        {weight != null && <span className="text-slate-600">{Math.round(weight * 100)}%</span>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="flex items-end justify-between">
                        <p className={`text-2xl font-bold ${col.text}`}>{m.score}</p>
                        {m.score >= 80 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : m.score >= 60 ? (
                          <Minus className="h-4 w-4 text-amber-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      {/* Score bar */}
                      <div className="mt-2 h-1.5 rounded-full bg-slate-800">
                        <div className={`h-1.5 rounded-full ${col.bar}`} style={{ width: `${m.score}%` }} />
                      </div>
                      {/* Top driver */}
                      {m.drivers?.[0] && (
                        <p className="mt-1.5 text-xs text-slate-500 truncate">{m.drivers[0].label}</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
          {mvp3Only && hiddenCount > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              More module scores coming when full platform is enabled ({hiddenCount} modules computed but hidden).
            </p>
          )}
        </div>
      )}

      {/* Score inputs */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm text-slate-300">
            <span>Score inputs (Phase 4 daily facts)</span>
            <Link href="/dashboard/school-intelligence/score-settings" className="text-xs text-sky-400 hover:underline">
              Adjust weights →
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-64 overflow-auto rounded-md bg-slate-950/80 p-3 text-xs text-slate-300">
            {row?.inputsJson ? JSON.stringify(row.inputsJson, null, 2) : 'No score inputs for this date.'}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
