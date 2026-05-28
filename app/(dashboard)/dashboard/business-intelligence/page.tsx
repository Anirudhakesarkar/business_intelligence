'use client';

import { useState } from 'react';
import { BrainCircuit, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BIFilterBar, type BIFilters } from '@/components/business-intelligence/BIFilterBar';
import { BIScoreCards, BIScoreCardsSkeleton, type ScoreData } from '@/components/business-intelligence/BIScoreCards';
import { BIAISummaryPanel } from '@/components/business-intelligence/BIAISummaryPanel';
import { BITopRiskAreas } from '@/components/business-intelligence/BITopRiskAreas';
import { BIAlertTrendCard } from '@/components/business-intelligence/BIAlertTrendCard';
import { BICameraHealthCard } from '@/components/business-intelligence/BICameraHealthCard';
import { BIRecommendationCard } from '@/components/business-intelligence/BIRecommendationCard';
import { BICopilotChat } from '@/components/business-intelligence/BICopilotChat';
import { generateRecommendations } from '@/lib/business-intelligence/recommendation-engine';
import { DEMO_SCORES } from '@/lib/business-intelligence/score-calculator';
import { useQuery } from '@tanstack/react-query';

const DEMO_SCORE_DATA: ScoreData = {
  ...DEMO_SCORES,
  openIncidents: 12,
};

const AI_SUMMARY =
  'Hannur Branch has a good overall safety score, but response time is weak during evening hours. Main Gate and Parking Area are generating repeated alerts. Camera health is stable, but two cameras have intermittent stream drops. Management should review operator availability between 5 PM and 8 PM.';

export default function BusinessIntelligencePage() {
  const [filters, setFilters] = useState<BIFilters>({
    organizationId: '',
    siteId: '',
    dateRange: '7d',
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['bi-overview', filters, refreshKey],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(filters.organizationId && { organizationId: filters.organizationId }),
        ...(filters.siteId && { siteId: filters.siteId }),
        dateRange: filters.dateRange,
      });
      const res = await fetch(`/api/business-intelligence/overview?${params}`);
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  const scoreData: ScoreData = data?.scores
    ? { ...data.scores, openIncidents: data.openIncidents ?? 0 }
    : DEMO_SCORE_DATA;

  const recommendations = generateRecommendations(
    data?.scores ?? DEMO_SCORES,
    {
      totalAlerts: data?.totalAlerts ?? 85,
      criticalAlerts: data?.scores?.safetyScore < 80 ? 12 : 3,
      repeatedAlerts: 31,
      unacknowledgedAlerts: 5,
      avgAcknowledgeMinutes: 7.4,
      avgResolutionMinutes: 142,
      slaBreaches: data?.scores?.complianceScore < 85 ? 6 : 1,
      autoClosed: 14,
      totalCameras: 24,
      onlineCameras: 22,
      streamDropCount: 8,
      offlineCriticalCameras: 1,
      edgeServerUptime: 98,
      openIncidents: scoreData.openIncidents ?? 12,
      unresolvedIncidentCount: 4,
      avgIncidentAgeDays: 2.1,
      criticalAreaAlerts: 18,
    }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-100">
            <BrainCircuit className="h-7 w-7 text-blue-400" />
            Business Intelligence
          </h1>
          <p className="text-sm text-slate-400">
            Turn camera alerts into management intelligence. Orion Alerts analyzes site activity,
            camera health, response behavior, risk areas, and recurring incidents to help management
            take faster and better decisions.
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={() => setRefreshKey((k) => k + 1)}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <BIFilterBar filters={filters} onChange={setFilters} />

      {/* Score cards */}
      {isLoading ? <BIScoreCardsSkeleton /> : <BIScoreCards data={scoreData} />}

      {/* AI Summary */}
      <BIAISummaryPanel summary={data?.summary ?? AI_SUMMARY} isLoading={isLoading} />

      {/* Bento grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <BIAlertTrendCard data={data?.alertTrend} />
          <BITopRiskAreas areas={data?.topRiskAreas} />
        </div>
        <div className="space-y-6">
          <BICameraHealthCard data={data?.cameraHealth} />
        </div>
      </div>

      {/* Recommendations preview */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Management Recommendations</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {recommendations.slice(0, 4).map((rec) => (
            <BIRecommendationCard key={rec.id} rec={rec} />
          ))}
        </div>
      </div>

      {/* Copilot */}
      <BICopilotChat organizationId={filters.organizationId} siteId={filters.siteId} dateRange={filters.dateRange} />

      {!data && !isLoading && (
        <p className="text-center text-xs text-slate-600">
          No live intelligence data available yet. Once alerts, camera health, and incidents are synced,
          Orion Alerts will calculate business insights for this site.
        </p>
      )}
    </div>
  );
}
