'use client';

import { useState, useMemo } from 'react';
import { SMPageHeader } from '@/components/school-management/SMPageHeader';
import { SchoolIntelligenceBreadcrumbs } from '@/components/school-intelligence/SchoolIntelligenceBreadcrumbs';
import { RuleEditSheet } from '@/components/school-intelligence/RuleEditSheet';
import { useIntelligenceRules, useSeedRuleEngine } from '@/components/school-intelligence/useSchoolRuleEngine';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, ShieldCheck, ToggleLeft, ToggleRight, Filter, Clock } from 'lucide-react';

type IntelligenceRule = {
  id: number;
  name: string;
  eventType: string;
  module: string;
  enabled: boolean;
  severityDefault: 'Low' | 'Medium' | 'High' | 'Critical';
  cooldownSeconds: number;
  version: number;
  updatedAt?: string;
  lastFiredAt?: string | null;
};

const MODULES = [
  'Core', 'TeacherProductivity', 'StudentOccupancy', 'AcademicOperations',
  'StaffDeployment', 'SpaceUtilization', 'Discipline', 'ParentExperience', 'Compliance',
];

const SEVERITY_COLORS: Record<string, string> = {
  Low: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  High: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Critical: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const MODULE_COLORS: Record<string, string> = {
  Core: 'text-slate-400',
  TeacherProductivity: 'text-blue-400',
  StudentOccupancy: 'text-sky-400',
  AcademicOperations: 'text-indigo-400',
  StaffDeployment: 'text-purple-400',
  SpaceUtilization: 'text-teal-400',
  Discipline: 'text-red-400',
  ParentExperience: 'text-green-400',
  Compliance: 'text-amber-400',
};

function SeverityBadge({ severity }: { severity: string }) {
  const cls = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.Low;
  return (
    <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs font-medium ${cls}`}>
      {severity}
    </span>
  );
}

function CooldownLabel({ seconds }: { seconds: number }) {
  if (seconds < 60) return <span className="text-xs text-slate-400">{seconds}s</span>;
  if (seconds < 3600) return <span className="text-xs text-slate-400">{Math.round(seconds / 60)}m</span>;
  return <span className="text-xs text-slate-400">{Math.round(seconds / 3600)}h</span>;
}

export default function RulesConfigPage() {
  const { data, isLoading, refetch } = useIntelligenceRules();
  const seed = useSeedRuleEngine();
  const qc = useQueryClient();

  const [filterModule, setFilterModule] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterEnabled, setFilterEnabled] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [search, setSearch] = useState('');
  const [toggling, setToggling] = useState<number | null>(null);
  const [editRuleId, setEditRuleId] = useState<number | null>(null);

  const allRules: IntelligenceRule[] = Array.isArray(data) ? (data as IntelligenceRule[]) : [];

  const rules = useMemo(() => {
    return allRules.filter((r) => {
      if (filterModule && r.module !== filterModule) return false;
      if (filterSeverity && r.severityDefault !== filterSeverity) return false;
      if (filterEnabled === 'enabled' && !r.enabled) return false;
      if (filterEnabled === 'disabled' && r.enabled) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.eventType.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [allRules, filterModule, filterSeverity, filterEnabled, search]);

  async function toggleRule(rule: IntelligenceRule) {
    const next = !rule.enabled;
    if (!next && rule.eventType === 'CriticalCameraOffline') {
      const ok = typeof window !== 'undefined' && window.confirm(
        'Disable Critical Camera Offline? This may hide compliance outages until re-enabled.',
      );
      if (!ok) return;
    }
    setToggling(rule.id);
    try {
      await fetch(`/api/intelligence-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      qc.invalidateQueries({ queryKey: ['intel-rules'] });
    } finally {
      setToggling(null);
    }
  }

  const enabledCount = allRules.filter((r) => r.enabled).length;
  const moduleGroups = useMemo(() => {
    const g: Record<string, number> = {};
    allRules.forEach((r) => { g[r.module] = (g[r.module] ?? 0) + 1; });
    return g;
  }, [allRules]);

  return (
    <div className="space-y-6">
      <SchoolIntelligenceBreadcrumbs current="Rules" />
      <SMPageHeader title="Intelligence Rules" subtitle="Rule catalog — enable/disable rules and review detection thresholds." />

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => seed.mutate()} disabled={seed.isPending}>
          <ShieldCheck className="mr-1 h-3 w-3" />
          {seed.isPending ? 'Seeding…' : 'Seed default rules'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="mr-1 h-3 w-3" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      {allRules.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="border-slate-800 bg-slate-900/50">
            <CardContent className="p-3">
              <p className="text-xs text-slate-500">Total rules</p>
              <p className="text-2xl font-bold text-slate-100">{allRules.length}</p>
            </CardContent>
          </Card>
          <Card className="border-green-900/40 bg-green-950/20">
            <CardContent className="p-3">
              <p className="text-xs text-green-500">Enabled</p>
              <p className="text-2xl font-bold text-green-300">{enabledCount}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900/50">
            <CardContent className="p-3">
              <p className="text-xs text-slate-500">Disabled</p>
              <p className="text-2xl font-bold text-slate-400">{allRules.length - enabledCount}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900/50">
            <CardContent className="p-3">
              <p className="text-xs text-slate-500">Modules</p>
              <p className="text-2xl font-bold text-slate-100">{Object.keys(moduleGroups).length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Module filter chips */}
      {Object.keys(moduleGroups).length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterModule('')}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              !filterModule ? 'border-sky-500 bg-sky-500/20 text-sky-300' : 'border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            All modules
          </button>
          {Object.entries(moduleGroups).map(([mod, count]) => (
            <button
              key={mod}
              onClick={() => setFilterModule(filterModule === mod ? '' : mod)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                filterModule === mod
                  ? 'border-sky-500 bg-sky-500/20 text-sky-300'
                  : 'border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              <span className={MODULE_COLORS[mod] ?? 'text-slate-400'}>{mod}</span>
              <span className="ml-1.5 rounded-full bg-slate-700 px-1.5 text-slate-300">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <Filter className="h-4 w-4 text-slate-500" />
        <input
          placeholder="Search rules…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 w-44"
        />
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
        >
          <option value="">All severities</option>
          {['Low', 'Medium', 'High', 'Critical'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex rounded border border-slate-700 overflow-hidden text-xs">
          {(['all', 'enabled', 'disabled'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilterEnabled(v)}
              className={`px-3 py-1.5 capitalize transition-colors ${
                filterEnabled === v ? 'bg-sky-700 text-white' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Rules table */}
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : allRules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center">
          <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-slate-600" />
          <p className="text-sm text-slate-500">No rules configured. Seed default rules to get started.</p>
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/80">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Rule</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Module</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Severity</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Last fired</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Cooldown</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Actions</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Enabled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rules.map((r) => (
                <tr key={r.id} className={`hover:bg-slate-800/30 ${!r.enabled ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-200">{r.name}</p>
                    <p className="text-xs text-slate-500">{r.eventType}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${MODULE_COLORS[r.module] ?? 'text-slate-400'}`}>
                      {r.module}
                    </span>
                  </td>
                  <td className="px-4 py-3"><SeverityBadge severity={r.severityDefault} /></td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {r.lastFiredAt ? new Date(r.lastFiredAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-slate-400">
                      <Clock className="h-3 w-3" />
                      <CooldownLabel seconds={r.cooldownSeconds} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setEditRuleId(r.id)}
                      className="text-xs text-sky-400 hover:underline"
                    >
                      Edit
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleRule(r)}
                      disabled={toggling === r.id}
                      className="flex items-center gap-1.5 text-xs transition-opacity disabled:opacity-50"
                      title={r.enabled ? 'Click to disable' : 'Click to enable'}
                    >
                      {r.enabled ? (
                        <ToggleRight className="h-5 w-5 text-green-400" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-slate-600" />
                      )}
                      <span className={r.enabled ? 'text-green-400' : 'text-slate-600'}>
                        {r.enabled ? 'On' : 'Off'}
                      </span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rules.length === 0 && (
            <p className="px-4 py-4 text-sm text-slate-500">No rules match the current filters.</p>
          )}
        </div>
      )}
      <RuleEditSheet ruleId={editRuleId} onClose={() => setEditRuleId(null)} />
    </div>
  );
}
