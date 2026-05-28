'use client';

import { Network, AlertTriangle, TrendingUp, Tag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export type AreaCard = {
  name: string;
  category: string;
  businessFunction: string;
  importance: 'Critical' | 'High' | 'Medium' | 'Low';
  kpiTags: string[];
  alertCount: number;
  riskLevel: 'High' | 'Medium' | 'Low';
  aiInsight?: string;
};

const DEMO_AREAS: AreaCard[] = [
  {
    name: 'Main Gate',
    category: 'Entrance / Exit',
    businessFunction: 'Safety Monitoring',
    importance: 'Critical',
    kpiTags: ['Safety Score', 'Unauthorized Access', 'Crowd Level'],
    alertCount: 42,
    riskLevel: 'High',
    aiInsight: 'Main Gate has repeated after-hours intrusion alerts and high crowd volume during morning entry. Consider stricter alert schedule and dedicated operator monitoring during 7:30 AM to 9:00 AM.',
  },
  {
    name: 'Parking Area',
    category: 'External Zone',
    businessFunction: 'Vehicle & Asset Monitoring',
    importance: 'High',
    kpiTags: ['Vehicle Loitering', 'Vandalism', 'After-Hours Access'],
    alertCount: 18,
    riskLevel: 'Medium',
    aiInsight: 'Weekend alert frequency is 3x higher than weekdays. Review patrol coverage on Saturday and Sunday evenings.',
  },
  {
    name: 'Warehouse',
    category: 'Storage / Operations',
    businessFunction: 'Inventory & Safety',
    importance: 'High',
    kpiTags: ['Safety Score', 'Access Compliance', 'Fire Safety'],
    alertCount: 7,
    riskLevel: 'Low',
  },
];

function riskVariant(level: string): 'destructive' | 'warning' | 'success' {
  if (level === 'High') return 'destructive';
  if (level === 'Medium') return 'warning';
  return 'success';
}

function importanceColor(imp: string): string {
  if (imp === 'Critical') return 'text-red-400';
  if (imp === 'High') return 'text-orange-400';
  if (imp === 'Medium') return 'text-yellow-400';
  return 'text-slate-400';
}

type Props = { areas?: AreaCard[]; isLoading?: boolean };

export function AreaRiskCards({ areas, isLoading }: Props) {
  const items = areas ?? DEMO_AREAS;

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-lg border border-slate-800 bg-slate-900" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((area) => (
        <Card key={area.name} className="border-slate-800 bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-100">{area.name}</h3>
                <p className="text-xs text-slate-500">{area.category}</p>
              </div>
              <Badge variant={riskVariant(area.riskLevel)}>{area.riskLevel} Risk</Badge>
            </div>

            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Business Function</span>
                <span className="text-slate-300">{area.businessFunction}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Importance</span>
                <span className={`font-medium ${importanceColor(area.importance)}`}>{area.importance}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Alerts (period)</span>
                <span className="flex items-center gap-1 text-slate-300">
                  <AlertTriangle className="h-3 w-3" /> {area.alertCount}
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1">
              {area.kpiTags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 rounded-full bg-blue-950/40 px-2 py-0.5 text-xs text-blue-300">
                  <Tag className="h-2.5 w-2.5" /> {tag}
                </span>
              ))}
            </div>

            {area.aiInsight && (
              <div className="mt-3 flex items-start gap-1.5 rounded-md bg-slate-800/60 p-2 text-xs text-slate-400">
                <TrendingUp className="mt-0.5 h-3 w-3 shrink-0 text-blue-400" />
                {area.aiInsight}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
