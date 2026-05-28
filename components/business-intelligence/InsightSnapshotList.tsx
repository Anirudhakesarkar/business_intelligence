'use client';

import { History, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type Snapshot = {
  id: string;
  snapshotDate: string;
  snapshotType: 'daily' | 'weekly' | 'monthly';
  safetyScore: number;
  cameraHealthScore: number;
  responseScore: number;
  complianceScore: number;
  riskLevel: 'High' | 'Medium' | 'Low';
  aiSummary?: string;
};

const DEMO_SNAPSHOTS: Snapshot[] = [
  {
    id: '1',
    snapshotDate: '2026-05-08',
    snapshotType: 'daily',
    safetyScore: 86,
    cameraHealthScore: 94,
    responseScore: 78,
    complianceScore: 82,
    riskLevel: 'Medium',
    aiSummary: 'Site performing well overall. Response time slightly above target during evening hours.',
  },
  {
    id: '2',
    snapshotDate: '2026-05-01',
    snapshotType: 'weekly',
    safetyScore: 81,
    cameraHealthScore: 91,
    responseScore: 74,
    complianceScore: 80,
    riskLevel: 'Medium',
    aiSummary: 'Week showed increased alert volume in Main Gate and Parking Area. Camera health stable.',
  },
  {
    id: '3',
    snapshotDate: '2026-04-30',
    snapshotType: 'monthly',
    safetyScore: 79,
    cameraHealthScore: 88,
    responseScore: 70,
    complianceScore: 77,
    riskLevel: 'High',
    aiSummary: 'April showed elevated risk. SLA breaches increased by 40%. Recommended: Review operator scheduling.',
  },
];

function typeVariant(t: string): 'secondary' | 'success' | 'warning' {
  if (t === 'daily') return 'secondary';
  if (t === 'weekly') return 'success';
  return 'warning';
}

function riskVariant(level: string): 'destructive' | 'warning' | 'success' {
  if (level === 'High') return 'destructive';
  if (level === 'Medium') return 'warning';
  return 'success';
}

function scoreColor(score: number) {
  if (score >= 85) return 'text-green-400';
  if (score >= 65) return 'text-yellow-400';
  return 'text-red-400';
}

type Props = {
  snapshots?: Snapshot[];
  isLoading?: boolean;
  onGenerateSnapshot?: () => void;
};

export function InsightSnapshotList({ snapshots, isLoading, onGenerateSnapshot }: Props) {
  const items = snapshots ?? DEMO_SNAPSHOTS;

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-slate-100">
          <History className="h-5 w-5 text-blue-400" /> Intelligence Snapshots
        </CardTitle>
        {onGenerateSnapshot && (
          <Button size="sm" onClick={onGenerateSnapshot}>
            Generate Snapshot
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded bg-slate-800" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((snap, idx) => {
              const prevSafety = idx < items.length - 1 ? items[idx + 1].safetyScore : snap.safetyScore;
              const trend = snap.safetyScore > prevSafety ? 'up' : snap.safetyScore < prevSafety ? 'down' : 'stable';
              return (
                <div key={snap.id} className="flex items-start gap-3 rounded-lg border border-slate-800 p-4 hover:bg-slate-800/30 transition-colors">
                  <div className="shrink-0 space-y-1 text-center">
                    <div className="text-lg font-bold text-slate-100">{snap.snapshotDate.slice(8, 10)}</div>
                    <div className="text-xs text-slate-500">{new Date(snap.snapshotDate).toLocaleString('default', { month: 'short' })}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={typeVariant(snap.snapshotType)} className="capitalize">{snap.snapshotType}</Badge>
                      <Badge variant={riskVariant(snap.riskLevel)}>{snap.riskLevel} Risk</Badge>
                      {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-400" />}
                      {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-400" />}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs">
                      <span>Safety: <span className={`font-bold ${scoreColor(snap.safetyScore)}`}>{snap.safetyScore}</span></span>
                      <span>Cameras: <span className={`font-bold ${scoreColor(snap.cameraHealthScore)}`}>{snap.cameraHealthScore}</span></span>
                      <span>Response: <span className={`font-bold ${scoreColor(snap.responseScore)}`}>{snap.responseScore}</span></span>
                      <span>Compliance: <span className={`font-bold ${scoreColor(snap.complianceScore)}`}>{snap.complianceScore}</span></span>
                    </div>
                    {snap.aiSummary && (
                      <p className="mt-1.5 text-xs text-slate-400 line-clamp-2">{snap.aiSummary}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
