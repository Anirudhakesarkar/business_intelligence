'use client';

import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { BIFilterBar, type BIFilters } from '@/components/business-intelligence/BIFilterBar';
import { BIScoreCards, BIScoreCardsSkeleton, type ScoreData } from '@/components/business-intelligence/BIScoreCards';
import { SiteIntelligenceSummary } from '@/components/business-intelligence/SiteIntelligenceSummary';
import { BIAlertTrendCard } from '@/components/business-intelligence/BIAlertTrendCard';
import { BIRecommendationCard } from '@/components/business-intelligence/BIRecommendationCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DEMO_SCORES } from '@/lib/business-intelligence/score-calculator';
import { generateRecommendations } from '@/lib/business-intelligence/recommendation-engine';
import { useQuery } from '@tanstack/react-query';

const DEMO_SCORE_DATA: ScoreData = { ...DEMO_SCORES, openIncidents: 12 };

const DEMO_METRICS = {
  avgAcknowledgeMinutes: 7.8,
  avgResolutionMinutes: 148,
  totalAlerts: 85,
  criticalAlerts: 8,
  repeatedAlerts: 31,
  unacknowledgedAlerts: 5,
  slaBreaches: 4,
  autoClosed: 14,
  totalCameras: 24,
  onlineCameras: 22,
  streamDropCount: 8,
  offlineCriticalCameras: 1,
  edgeServerUptime: 98,
  openIncidents: 12,
  unresolvedIncidentCount: 4,
  avgIncidentAgeDays: 2.1,
  criticalAreaAlerts: 18,
};

export default function SiteIntelligencePage() {
  const [filters, setFilters] = useState<BIFilters>({ organizationId: '', siteId: '', dateRange: '7d' });

  const { data, isLoading } = useQuery({
    queryKey: ['bi-site', filters],
    queryFn: async () => {
      const params = new URLSearchParams({ dateRange: filters.dateRange });
      const res = await fetch(`/api/business-intelligence/site?${params}`);
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  const scoreData: ScoreData = data?.scores ? { ...data.scores } : DEMO_SCORE_DATA;
  const recommendations = generateRecommendations(data?.scores ?? DEMO_SCORES, DEMO_METRICS).slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-100">
          <Building2 className="h-7 w-7 text-blue-400" /> Site Intelligence
        </h1>
        <p className="text-sm text-slate-400">Compare site performance, risk, safety, response, and camera health across all locations.</p>
      </div>

      <BIFilterBar filters={filters} onChange={setFilters} />

      {isLoading ? <BIScoreCardsSkeleton /> : <BIScoreCards data={scoreData} />}

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-100">Site Comparison</h2>
        <SiteIntelligenceSummary sites={data?.sites} isLoading={isLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <BIAlertTrendCard data={data?.alertTrend} />

        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-100">Site Response Time</CardTitle>
            <p className="text-xs text-slate-500">Average acknowledge and close time by site</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { site: 'Hannur Branch', ack: '7.4m', close: '2.4h', slaMet: false },
                { site: 'MG Road Office', ack: '3.2m', close: '1.1h', slaMet: true },
                { site: 'Koramangala Site', ack: '11.8m', close: '4.2h', slaMet: false },
              ].map((row) => (
                <div key={row.site} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{row.site}</span>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-slate-400">Ack: <span className={row.slaMet ? 'text-green-400' : 'text-red-400'}>{row.ack}</span></span>
                    <span className="text-slate-400">Close: {row.close}</span>
                    <span className={`rounded px-1.5 py-0.5 text-xs ${row.slaMet ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                      {row.slaMet ? 'SLA Met' : 'SLA Breach'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Site Recommendations</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {recommendations.map((rec) => (
            <BIRecommendationCard key={rec.id} rec={rec} />
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-slate-600">
        No live intelligence data available yet. Once alerts, camera health, and incidents are synced, Orion Alerts will calculate business insights for this site.
      </p>
    </div>
  );
}
