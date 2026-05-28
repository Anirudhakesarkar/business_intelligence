'use client';

import { Building2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export type SiteScore = {
  siteName: string;
  safetyScore: number;
  responseScore: number;
  cameraHealthScore: number;
  complianceScore: number;
  riskLevel: 'High' | 'Medium' | 'Low';
  trend?: 'up' | 'down' | 'stable';
};

const DEMO_SITES: SiteScore[] = [
  { siteName: 'Hannur Branch', safetyScore: 86, responseScore: 72, cameraHealthScore: 94, complianceScore: 81, riskLevel: 'Medium', trend: 'up' },
  { siteName: 'MG Road Office', safetyScore: 91, responseScore: 88, cameraHealthScore: 98, complianceScore: 90, riskLevel: 'Low', trend: 'stable' },
  { siteName: 'Koramangala Site', safetyScore: 64, responseScore: 55, cameraHealthScore: 78, complianceScore: 68, riskLevel: 'High', trend: 'down' },
];

function scoreColor(score: number) {
  if (score >= 85) return 'text-green-400';
  if (score >= 65) return 'text-yellow-400';
  return 'text-red-400';
}

function riskVariant(level: string): 'destructive' | 'warning' | 'success' {
  if (level === 'High') return 'destructive';
  if (level === 'Medium') return 'warning';
  return 'success';
}

type Props = { sites?: SiteScore[]; isLoading?: boolean };

export function SiteIntelligenceSummary({ sites, isLoading }: Props) {
  const items = sites ?? DEMO_SITES;

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-lg border border-slate-800 bg-slate-900" />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900">
          <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
            <th className="px-4 py-3">Site</th>
            <th className="px-4 py-3">Safety</th>
            <th className="px-4 py-3">Response</th>
            <th className="px-4 py-3">Cameras</th>
            <th className="px-4 py-3">Compliance</th>
            <th className="px-4 py-3">Risk</th>
            <th className="px-4 py-3">Trend</th>
          </tr>
        </thead>
        <tbody className="bg-slate-900/50">
          {items.map((site) => (
            <tr key={site.siteName} className="border-b border-slate-800/60 hover:bg-slate-800/30">
              <td className="px-4 py-3 font-medium text-slate-200">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-500" />
                  {site.siteName}
                </div>
              </td>
              <td className={`px-4 py-3 font-bold ${scoreColor(site.safetyScore)}`}>{site.safetyScore}</td>
              <td className={`px-4 py-3 font-bold ${scoreColor(site.responseScore)}`}>{site.responseScore}</td>
              <td className={`px-4 py-3 font-bold ${scoreColor(site.cameraHealthScore)}`}>{site.cameraHealthScore}</td>
              <td className={`px-4 py-3 font-bold ${scoreColor(site.complianceScore)}`}>{site.complianceScore}</td>
              <td className="px-4 py-3">
                <Badge variant={riskVariant(site.riskLevel)}>{site.riskLevel}</Badge>
              </td>
              <td className="px-4 py-3">
                {site.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-400" />}
                {site.trend === 'down' && <TrendingDown className="h-4 w-4 text-red-400" />}
                {site.trend === 'stable' && <Minus className="h-4 w-4 text-slate-400" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
