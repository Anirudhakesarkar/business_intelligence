'use client';

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { BIFilterBar, type BIFilters } from '@/components/business-intelligence/BIFilterBar';
import { OperationalRiskPanel } from '@/components/business-intelligence/OperationalRiskPanel';
import { BIRecommendationCard } from '@/components/business-intelligence/BIRecommendationCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { generateRecommendations } from '@/lib/business-intelligence/recommendation-engine';
import { DEMO_SCORES } from '@/lib/business-intelligence/score-calculator';
import { useQuery } from '@tanstack/react-query';

const DEMO_METRICS = {
  totalAlerts: 85, criticalAlerts: 12, repeatedAlerts: 42, unacknowledgedAlerts: 9,
  avgAcknowledgeMinutes: 9.1, avgResolutionMinutes: 190, slaBreaches: 8, autoClosed: 14,
  totalCameras: 24, onlineCameras: 22, streamDropCount: 8, offlineCriticalCameras: 1,
  edgeServerUptime: 97, openIncidents: 12, unresolvedIncidentCount: 6,
  avgIncidentAgeDays: 3.4, criticalAreaAlerts: 22,
};

const RISK_TREND = [
  { label: 'Mon', score: 38 }, { label: 'Tue', score: 44 }, { label: 'Wed', score: 41 },
  { label: 'Thu', score: 52 }, { label: 'Fri', score: 48 }, { label: 'Sat', score: 55 },
  { label: 'Sun', score: 42 },
];

export default function OperationalRiskPage() {
  const [filters, setFilters] = useState<BIFilters>({ organizationId: '', siteId: '', dateRange: '7d' });

  const { data, isLoading } = useQuery({
    queryKey: ['bi-operational-risk', filters],
    queryFn: async () => {
      const res = await fetch(`/api/business-intelligence/operational-risk?dateRange=${filters.dateRange}`);
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  const recs = generateRecommendations(DEMO_SCORES, DEMO_METRICS).filter(
    (r) => ['High-Risk Area Monitoring', 'Site Safety Improvement', 'SLA Improvement'].includes(r.category)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-100">
          <ShieldAlert className="h-7 w-7 text-orange-400" /> Operational Risk
        </h1>
        <p className="text-sm text-slate-400">Business risk across site operations — combining alerts, incidents, camera health, response time, area importance, and AI rule priority.</p>
      </div>

      <BIFilterBar filters={filters} onChange={setFilters} />

      <OperationalRiskPanel
        riskScore={data?.riskScore ?? 42}
        riskLevel={data?.riskLevel ?? 'Medium'}
        highRiskAreas={data?.highRiskAreas ?? 2}
        criticalIncidents={data?.criticalIncidents ?? 5}
        slaBreaches={data?.slaBreaches ?? 3}
        blindSpots={data?.blindSpots ?? 1}
        risks={data?.risks}
        isLoading={isLoading}
      />

      {/* Risk trend */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-100">Risk Score Trend</CardTitle>
          <p className="text-xs text-slate-500">Operational risk score over the period (0–100)</p>
        </CardHeader>
        <CardContent>
          <div className="flex h-24 items-end gap-2">
            {RISK_TREND.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t transition-all ${d.score > 50 ? 'bg-red-500/70' : d.score > 35 ? 'bg-yellow-500/70' : 'bg-green-500/70'}`}
                  style={{ height: `${d.score}%` }}
                />
                <span className="text-[10px] text-slate-500">{d.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> Low (0–30)</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500" /> Medium (31–70)</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> High (71–100)</span>
          </div>
        </CardContent>
      </Card>

      {/* Risk recommendations */}
      {recs.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Risk Recommendations</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {recs.slice(0, 4).map((rec) => <BIRecommendationCard key={rec.id} rec={rec} />)}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-slate-600">
        No live intelligence data available yet. Once alerts, camera health, and incidents are synced, Orion Alerts will calculate operational risk.
      </p>
    </div>
  );
}
