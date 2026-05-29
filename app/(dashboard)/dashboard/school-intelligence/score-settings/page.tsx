'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { usePageHeaderRefresh } from '@/components/layout/page-header-context';
import { SchoolIntelligenceBreadcrumbs } from '@/components/school-intelligence/SchoolIntelligenceBreadcrumbs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DEFAULT_WEIGHTS, MODULE_LABELS } from '@/lib/school-score-engine/weights';
import type { ScoreModuleKey } from '@/lib/school-score-engine/types';
import { schoolFetch } from '@/lib/school-auth/client-fetch';
import { isMvp3ScoresOnlyClient } from '@/components/school-intelligence/scoreVisibility';

const KEYS = Object.keys(DEFAULT_WEIGHTS) as ScoreModuleKey[];

function demoRole(): string {
  if (typeof window === 'undefined') return 'org_admin';
  return localStorage.getItem('school-demo-role') ?? 'org_admin';
}

export default function ScoreSettingsPage() {
  const [weights, setWeights] = useState<Record<ScoreModuleKey, number>>({ ...DEFAULT_WEIGHTS });
  const [profiles, setProfiles] = useState<unknown[]>([]);
  const [previewOverall, setPreviewOverall] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [applyNow, setApplyNow] = useState(false);
  const [role, setRole] = useState('org_admin');
  const orgId = 1;
  const date = new Date().toISOString().slice(0, 10);
  const readOnly = role === 'site_viewer';

  const load = useCallback(async () => {
    const res = await schoolFetch(`/api/school-scores/weight-profiles?organizationId=${orgId}`);
    const data = await res.json();
    setProfiles(data.profiles ?? []);
    const overallRes = await schoolFetch(`/api/school-scores/overall?organizationId=${orgId}&date=${date}`);
    const overall = await overallRes.json();
    if (overall.moduleScores?.length) {
      let total = 0;
      let sum = 0;
      for (const m of overall.moduleScores) {
        const w = weights[m.moduleKey as ScoreModuleKey] ?? 0;
        total += m.score * w;
        sum += w;
      }
      setPreviewOverall(sum ? Math.round(total / sum) : null);
    }
  }, [weights, orgId, date]);

  useEffect(() => {
    setRole(demoRole());
    void load();
  }, [load]);

  usePageHeaderRefresh(load);

  const sumPct = Math.round(Object.values(weights).reduce((a, b) => a + b, 0) * 100);

  async function save() {
    if (readOnly) return;
    if (applyNow && !window.confirm('Apply new weights immediately for today? Historical scores for past dates stay unchanged.')) {
      return;
    }
    setSaving(true);
    const effective = new Date();
    if (!applyNow) effective.setDate(effective.getDate() + 1);
    const effectiveFrom = effective.toISOString().slice(0, 10);
    await schoolFetch('/api/school-scores/weight-profiles', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-school-role': role },
      body: JSON.stringify({
        organizationId: orgId,
        effectiveFrom,
        profileName: applyNow ? 'custom-immediate' : 'custom',
        weights: Object.fromEntries(KEYS.map((k) => [k, weights[k]])),
      }),
    });
    await schoolFetch(`/api/school-scores/calculate?organizationId=${orgId}&date=${date}`, {
      method: 'POST',
      headers: { 'x-school-role': role },
    });
    setSaving(false);
    void load();
  }

  return (
    <div className="space-y-6">
      <SchoolIntelligenceBreadcrumbs current="Score Settings" />
      <p className="text-sm text-slate-400">
        Weight profiles are versioned — saving creates a new profile without rewriting historical scores.
        {isMvp3ScoresOnlyClient() && ' MVP3 mode: overall uses Teacher, Occupancy, Academic, and Parent only.'}
      </p>
      {readOnly && (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-200">
          Read-only for site viewers. Switch demo role to org_admin in localStorage key <code className="text-amber-100">school-demo-role</code>.
        </p>
      )}
      <label className="flex items-center gap-2 text-xs text-slate-500">
        Demo role (localStorage)
        <select
          value={role}
          onChange={(e) => {
            localStorage.setItem('school-demo-role', e.target.value);
            setRole(e.target.value);
          }}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
        >
          <option value="org_admin">org_admin</option>
          <option value="site_viewer">site_viewer</option>
        </select>
      </label>
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-sm text-slate-300">Overall weight profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {KEYS.map((k) => (
            <label key={k} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-300">{MODULE_LABELS[k]}</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={30}
                  disabled={readOnly}
                  value={Math.round(weights[k] * 100)}
                  onChange={(e) => setWeights((w) => ({ ...w, [k]: Number(e.target.value) / 100 }))}
                  className="w-32"
                />
                <span className="w-10 text-right text-slate-400">{Math.round(weights[k] * 100)}%</span>
              </div>
            </label>
          ))}
          <p className={`text-xs ${sumPct === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>Total: {sumPct}% (target 100%)</p>
          {previewOverall != null && <p className="text-sm text-sky-300">Preview overall (today): {previewOverall}</p>}
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input type="checkbox" checked={applyNow} disabled={readOnly} onChange={(e) => setApplyNow(e.target.checked)} />
            Apply immediately (otherwise effective next calendar day)
          </label>
          <Button disabled={readOnly || saving || sumPct !== 100} onClick={() => save()} className="bg-sky-700 hover:bg-sky-600">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save profile & recalculate
          </Button>
        </CardContent>
      </Card>
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader><CardTitle className="text-sm text-slate-400">Version history</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2 text-xs text-slate-500">
            {(profiles as { id: number; profileName: string; effectiveFrom: string }[]).map((p) => (
              <li key={p.id}>#{p.id} {p.profileName} — effective {p.effectiveFrom}</li>
            ))}
            {!profiles.length && <li>Default docx weights only.</li>}
          </ul>
        </CardContent>
      </Card>
      <Link href="/dashboard/school-intelligence/rules" className="text-sm text-sky-400 hover:underline">Edit intelligence rules →</Link>
    </div>
  );
}
