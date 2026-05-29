'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SchoolIntelligenceBreadcrumbs } from '@/components/school-intelligence/SchoolIntelligenceBreadcrumbs';
import { SIFilterBar } from '@/components/school-intelligence/SIFilterBar';
import { usePageHeaderRefresh } from '@/components/layout/page-header-context';
import { useSchoolModuleScore } from '@/components/school-intelligence/useSchoolModuleScore';
import { useSchoolScoreCompare } from '@/components/school-intelligence/useSchoolScores';
import { buildObservationChartData } from '@/lib/school-intelligence/observation-chart';
import {
  loadModuleObservations,
  sortObservationsNewest,
} from '@/lib/school-intelligence/module-observations';
import {
  formatSIFilterPeriodLabel,
  resolveSIFilterDates,
  scoreCompareLabel,
} from '@/lib/school-intelligence/date-range';
import type { SIStandardModuleConfig } from '@/lib/school-intelligence/module-standard/types';
import type { SIFilters } from '@/lib/school-intelligence/types';
import { resolveOrganizationId } from '@/lib/school-intelligence/resolve-org-id';
import { SIObservationTrendCard } from './SIObservationTrendCard';
import { SIObservationMetricCards } from './SIObservationMetricCards';
import { SIObservationTypesGrid } from './SIObservationTypesGrid';
import { SIObservationFeed } from './SIObservationFeed';
import { SIModuleScorePanel } from './SIModuleScorePanel';

type Props = {
  config: SIStandardModuleConfig;
};

export function SIStandardModulePage({ config }: Props) {
  const [filters, setFilters] = useState<SIFilters>({
    organizationId: '',
    siteId: '',
    dateRange: '7d',
  });
  const orgId = resolveOrganizationId(filters);
  const [observations, setObservations] = useState<Awaited<ReturnType<typeof loadModuleObservations>>>([]);
  const [observationsLoading, setObservationsLoading] = useState(true);
  const [observationsError, setObservationsError] = useState<string | null>(null);

  const { to: summaryDate, from: periodStart } = resolveSIFilterDates(filters);
  const periodLabel = formatSIFilterPeriodLabel(filters);
  const compareLabel = scoreCompareLabel(filters.dateRange, periodStart, summaryDate);

  const moduleScore = useSchoolModuleScore(config.scoreModuleKey, orgId, summaryDate, filters.siteId);
  const scoreCompare = useSchoolScoreCompare(orgId, filters);
  const compareRow = scoreCompare.data?.moduleDeltas.find(
    (m) => m.moduleKey === config.scoreModuleKey,
  );

  const loadObservations = useCallback(async () => {
    setObservationsLoading(true);
    setObservationsError(null);
    try {
      const rows = await loadModuleObservations(config, filters, orgId);
      setObservations(sortObservationsNewest(rows));
    } catch (e) {
      setObservations([]);
      setObservationsError(e instanceof Error ? e.message : 'Failed to load observations');
    } finally {
      setObservationsLoading(false);
    }
  }, [config, filters, orgId]);

  useEffect(() => {
    void loadObservations();
  }, [loadObservations]);

  const periodObservations = useMemo(() => observations, [observations]);

  const chartBuckets = useMemo(
    () => buildObservationChartData(periodObservations, filters),
    [periodObservations, filters],
  );

  const metricCards = useMemo(
    () => config.metricCards(periodObservations),
    [config, periodObservations],
  );

  const score =
    moduleScore.score ?? compareRow?.current ?? null;
  const priorScore =
    moduleScore.priorScore ?? compareRow?.prior ?? null;
  const scoreDelta =
    moduleScore.delta ?? compareRow?.delta ?? null;

  const handleRefresh = useCallback(() => {
    void loadObservations();
    void moduleScore.reload();
    void scoreCompare.reload();
  }, [loadObservations, moduleScore.reload, scoreCompare.reload]);

  usePageHeaderRefresh(handleRefresh);

  return (
    <div className="space-y-6">
      <SchoolIntelligenceBreadcrumbs current={config.breadcrumb} />
      <SIFilterBar filters={filters} onChange={setFilters} />

      {(observationsError || moduleScore.error) && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {observationsError && <p>Observations: {observationsError}</p>}
          {moduleScore.error && <p>Module score: {moduleScore.error}</p>}
        </div>
      )}

      <SIObservationTrendCard buckets={chartBuckets} periodLabel={periodLabel} />

      <SIObservationMetricCards cards={metricCards} />

      <SIObservationTypesGrid
        config={config}
        observations={periodObservations}
        periodLabel={periodLabel}
      />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <SIObservationFeed
          config={config}
          observations={periodObservations}
          loading={observationsLoading}
          periodLabel={periodLabel}
        />
        <SIModuleScorePanel
          config={config}
          score={score}
          priorScore={priorScore}
          scoreDelta={scoreDelta}
          compareLabel={compareLabel}
          filters={filters}
          periodStart={periodStart}
          periodEnd={summaryDate}
          periodLabel={periodLabel}
          observations={periodObservations}
          loading={moduleScore.loading || scoreCompare.loading}
        />
      </div>
    </div>
  );
}
