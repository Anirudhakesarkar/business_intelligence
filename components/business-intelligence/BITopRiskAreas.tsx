'use client';

import { Network, AlertTriangle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export type RiskArea = {
  name: string;
  category: string;
  riskLevel: 'High' | 'Medium' | 'Low';
  alertCount: number;
  insight?: string;
};

const DEMO_AREAS: RiskArea[] = [
  {
    name: 'Main Gate',
    category: 'Entrance / Exit',
    riskLevel: 'High',
    alertCount: 42,
    insight: 'Repeated after-hours intrusion alerts and high crowd volume during morning entry.',
  },
  {
    name: 'Parking Area',
    category: 'External Zone',
    riskLevel: 'Medium',
    alertCount: 18,
    insight: 'Vehicle loitering and vandalism alerts increasing on weekends.',
  },
  {
    name: 'Server Room',
    category: 'Critical Infrastructure',
    riskLevel: 'Low',
    alertCount: 3,
    insight: 'Access attempts outside normal hours detected twice this week.',
  },
];

function riskVariant(level: string): 'destructive' | 'warning' | 'success' {
  if (level === 'High') return 'destructive';
  if (level === 'Medium') return 'warning';
  return 'success';
}

type Props = { areas?: RiskArea[]; isLoading?: boolean };

export function BITopRiskAreas({ areas, isLoading }: Props) {
  const items = areas ?? DEMO_AREAS;

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
          <Network className="h-4 w-4 text-orange-400" /> Top Risk Areas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded bg-slate-800" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((area) => (
              <div key={area.name} className="rounded-lg border border-slate-800 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{area.name}</p>
                    <p className="text-xs text-slate-500">{area.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <AlertTriangle className="h-3.5 w-3.5" /> {area.alertCount} alerts
                    </span>
                    <Badge variant={riskVariant(area.riskLevel)}>{area.riskLevel}</Badge>
                  </div>
                </div>
                {area.insight && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
                    <TrendingUp className="mt-0.5 h-3 w-3 shrink-0 text-blue-400" />
                    {area.insight}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        {!areas && !isLoading && (
          <p className="mt-2 text-center text-xs text-slate-600">Demo data — connect live area data to see real results</p>
        )}
      </CardContent>
    </Card>
  );
}
