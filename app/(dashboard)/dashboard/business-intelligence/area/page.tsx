'use client';

import { useState } from 'react';
import { Network } from 'lucide-react';
import { BIFilterBar, type BIFilters } from '@/components/business-intelligence/BIFilterBar';
import { AreaRiskCards } from '@/components/business-intelligence/AreaRiskCards';
import { BIAlertTrendCard } from '@/components/business-intelligence/BIAlertTrendCard';
import { BIAISummaryPanel } from '@/components/business-intelligence/BIAISummaryPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';

const AREA_COPILOT_SUMMARY =
  'Main Gate has repeated after-hours intrusion alerts and high crowd volume during morning entry. Consider stricter alert schedule and dedicated operator monitoring during 7:30 AM to 9:00 AM. Parking Area weekend alert frequency is 3× weekday levels — review patrol coverage.';

export default function AreaIntelligencePage() {
  const [filters, setFilters] = useState<BIFilters>({ organizationId: '', siteId: '', dateRange: '7d' });

  const { data, isLoading } = useQuery({
    queryKey: ['bi-area', filters],
    queryFn: async () => {
      const params = new URLSearchParams({ dateRange: filters.dateRange });
      const res = await fetch(`/api/business-intelligence/area?${params}`);
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-100">
          <Network className="h-7 w-7 text-blue-400" /> Area Intelligence
        </h1>
        <p className="text-sm text-slate-400">
          Camera → Area → Business Function → Risk → KPI. Understand which physical areas drive risk and operational outcomes.
        </p>
      </div>

      <BIFilterBar filters={filters} onChange={setFilters} />

      <BIAISummaryPanel summary={data?.copilotSummary ?? AREA_COPILOT_SUMMARY} isLoading={isLoading} />

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Area Overview Cards</h2>
        <AreaRiskCards areas={data?.areas} isLoading={isLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <BIAlertTrendCard data={data?.alertTrend} />

        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-100">Area Business Context</CardTitle>
            <p className="text-xs text-slate-500">Business function mapping from camera area metadata</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {[
                { area: 'Main Gate', function: 'Safety Monitoring', kpi: 'Unauthorized Access', importance: 'Critical' },
                { area: 'Parking Area', function: 'Vehicle Monitoring', kpi: 'Vandalism, Loitering', importance: 'High' },
                { area: 'Warehouse', function: 'Inventory Safety', kpi: 'Fire, Compliance', importance: 'High' },
                { area: 'Reception', function: 'Visitor Management', kpi: 'Crowd Level, Queue', importance: 'Medium' },
              ].map((row) => (
                <div key={row.area} className="rounded-lg border border-slate-800 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-200">{row.area}</span>
                    <span className={`text-xs font-medium ${row.importance === 'Critical' ? 'text-red-400' : row.importance === 'High' ? 'text-orange-400' : 'text-yellow-400'}`}>
                      {row.importance}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {row.function} · KPIs: {row.kpi}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-slate-600">
        No live intelligence data available yet. Once alerts, camera health, and incidents are synced, Orion Alerts will calculate area business insights.
      </p>
    </div>
  );
}
