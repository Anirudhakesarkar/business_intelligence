'use client';

import { useState } from 'react';
import { Sparkles, Filter } from 'lucide-react';
import { BIFilterBar, type BIFilters } from '@/components/business-intelligence/BIFilterBar';
import { BIRecommendationCard } from '@/components/business-intelligence/BIRecommendationCard';
import { generateRecommendations, type RecommendationCategory } from '@/lib/business-intelligence/recommendation-engine';
import { DEMO_SCORES } from '@/lib/business-intelligence/score-calculator';

const DEMO_METRICS = {
  totalAlerts: 247, criticalAlerts: 18, repeatedAlerts: 61, unacknowledgedAlerts: 9,
  avgAcknowledgeMinutes: 9.1, avgResolutionMinutes: 190, slaBreaches: 8, autoClosed: 24,
  totalCameras: 24, onlineCameras: 22, streamDropCount: 33, offlineCriticalCameras: 1,
  edgeServerUptime: 97, openIncidents: 12, unresolvedIncidentCount: 6,
  avgIncidentAgeDays: 3.4, criticalAreaAlerts: 22,
};

const ALL_CATEGORIES: RecommendationCategory[] = [
  'Operator Staffing', 'Camera Maintenance', 'Alert Rule Tuning',
  'SLA Improvement', 'High-Risk Area Monitoring', 'Site Safety Improvement', 'Compliance Improvement',
];

type StatusFilter = 'Open' | 'Approved' | 'Dismissed' | 'Implemented';

export default function RecommendationsPage() {
  const [filters, setFilters] = useState<BIFilters>({ organizationId: '', siteId: '', dateRange: '7d' });
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Open');
  const [statuses, setStatuses] = useState<Record<string, StatusFilter>>({});

  const allRecs = generateRecommendations(DEMO_SCORES, DEMO_METRICS);
  const filtered = allRecs.filter((r) => {
    const status = statuses[r.id] ?? 'Open';
    const catOk = categoryFilter === 'All' || r.category === categoryFilter;
    const statusOk = statusFilter === 'Open' ? status === 'Open' : status === statusFilter;
    return catOk && statusOk;
  });

  const handleApprove = (id: string) => setStatuses((s) => ({ ...s, [id]: 'Approved' }));
  const handleDismiss = (id: string) => setStatuses((s) => ({ ...s, [id]: 'Dismissed' }));
  const handleImplemented = (id: string) => setStatuses((s) => ({ ...s, [id]: 'Implemented' }));

  const counts = {
    Open: allRecs.filter((r) => !statuses[r.id] || statuses[r.id] === 'Open').length,
    Approved: Object.values(statuses).filter((s) => s === 'Approved').length,
    Implemented: Object.values(statuses).filter((s) => s === 'Implemented').length,
    Dismissed: Object.values(statuses).filter((s) => s === 'Dismissed').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-100">
          <Sparkles className="h-7 w-7 text-blue-400" /> AI Recommendations
        </h1>
        <p className="text-sm text-slate-400">Prioritized management actions generated from intelligence analysis. Approve, implement, or dismiss each recommendation.</p>
      </div>

      <BIFilterBar filters={filters} onChange={setFilters} />

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {(['Open', 'Approved', 'Implemented', 'Dismissed'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-blue-600 text-white'
                : 'border border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {s}
            <span className={`rounded-full px-1.5 py-0.5 text-xs ${statusFilter === s ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
              {counts[s]}
            </span>
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-slate-500" />
        {['All', ...ALL_CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              categoryFilter === cat
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Recommendation cards */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900 py-16 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-3 text-slate-400">No recommendations in this category.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((rec) => (
            <BIRecommendationCard
              key={rec.id}
              rec={rec}
              status={statuses[rec.id] ?? 'Open'}
              onApprove={handleApprove}
              onDismiss={handleDismiss}
              onMarkImplemented={handleImplemented}
            />
          ))}
        </div>
      )}

      <p className="text-center text-xs text-slate-600">
        No live intelligence data available yet. Once alerts, camera health, and incidents are synced, Orion Alerts will generate live recommendations.
      </p>
    </div>
  );
}
