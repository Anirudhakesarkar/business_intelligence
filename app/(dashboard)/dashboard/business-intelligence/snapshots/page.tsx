'use client';

import { useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { BIFilterBar, type BIFilters } from '@/components/business-intelligence/BIFilterBar';
import { InsightSnapshotList } from '@/components/business-intelligence/InsightSnapshotList';
import { BIScoreCards, type ScoreData } from '@/components/business-intelligence/BIScoreCards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DEMO_SCORES } from '@/lib/business-intelligence/score-calculator';
import { useQuery } from '@tanstack/react-query';

const DEMO_SCORE_DATA: ScoreData = { ...DEMO_SCORES, openIncidents: 12 };

const SCORE_HISTORY = [
  { label: 'W1', safety: 79, camera: 88, response: 70, compliance: 77 },
  { label: 'W2', safety: 81, camera: 90, response: 72, compliance: 79 },
  { label: 'W3', safety: 84, camera: 92, response: 75, compliance: 81 },
  { label: 'W4', safety: 86, camera: 94, response: 78, compliance: 82 },
];

export default function InsightSnapshotsPage() {
  const [filters, setFilters] = useState<BIFilters>({ organizationId: '', siteId: '', dateRange: '7d' });
  const [generating, setGenerating] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bi-snapshots', filters],
    queryFn: async () => {
      const res = await fetch(`/api/business-intelligence/snapshots?dateRange=${filters.dateRange}`);
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  async function handleGenerateSnapshot() {
    setGenerating(true);
    try {
      await fetch('/api/business-intelligence/snapshots/generate', { method: 'POST' });
      await refetch();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-100">
            <History className="h-7 w-7 text-blue-400" /> Insight Snapshots
          </h1>
          <p className="text-sm text-slate-400">
            Daily, weekly, and monthly intelligence snapshots for management reporting and before/after comparison.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1 shrink-0"
          onClick={handleGenerateSnapshot}
          disabled={generating}
        >
          <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Generating…' : 'Generate Snapshot'}
        </Button>
      </div>

      <BIFilterBar filters={filters} onChange={setFilters} />

      {/* Latest scores */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-slate-400 uppercase tracking-wider">Latest Snapshot Scores</h2>
        <BIScoreCards data={DEMO_SCORE_DATA} />
      </div>

      {/* Score history trend */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-100">Score History Trend</CardTitle>
          <p className="text-xs text-slate-500">Weekly score progression</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-6">Week</th>
                  <th className="pb-2 pr-6">Safety</th>
                  <th className="pb-2 pr-6">Cameras</th>
                  <th className="pb-2 pr-6">Response</th>
                  <th className="pb-2">Compliance</th>
                </tr>
              </thead>
              <tbody>
                {SCORE_HISTORY.map((row, i) => {
                  const prev = i > 0 ? SCORE_HISTORY[i - 1] : null;
                  const safetyUp = prev ? row.safety > prev.safety : null;
                  return (
                    <tr key={row.label} className={`border-b border-slate-800/50 ${i === SCORE_HISTORY.length - 1 ? 'font-semibold' : ''}`}>
                      <td className="py-2.5 pr-6 text-slate-400">{row.label}</td>
                      {(['safety', 'camera', 'response', 'compliance'] as const).map((key) => {
                        const val = row[key as keyof typeof row] as number;
                        return (
                          <td key={key} className={`py-2.5 pr-6 font-mono ${val >= 85 ? 'text-green-400' : val >= 65 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Snapshot list */}
      <InsightSnapshotList
        snapshots={data?.snapshots}
        isLoading={isLoading}
        onGenerateSnapshot={handleGenerateSnapshot}
      />

      <p className="text-center text-xs text-slate-600">
        No live intelligence data available yet. Once alerts, camera health, and incidents are synced, Orion Alerts will store intelligence snapshots for management reporting.
      </p>
    </div>
  );
}
