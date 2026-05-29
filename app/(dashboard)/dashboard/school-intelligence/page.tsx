'use client';

import { useCallback, useState } from 'react';
import { useSchoolDailyOverview } from '@/components/school-intelligence/useSchoolDailySummaries';
import { useSchoolOverallScore, useSchoolScoreCompare } from '@/components/school-intelligence/useSchoolScores';
import { resolveSIFilterDates, scoreCompareLabel } from '@/lib/school-intelligence/date-range';
import { usePageHeaderRefresh } from '@/components/layout/page-header-context';
import { SchoolIntelligenceBreadcrumbs } from '@/components/school-intelligence/SchoolIntelligenceBreadcrumbs';
import { SIFilterBar } from '@/components/school-intelligence/SIFilterBar';
import { SIModuleScoreGrid } from '@/components/school-intelligence/SIModuleScoreGrid';
import type { SIFilters } from '@/lib/school-intelligence/types';
import { MODULE_LABELS } from '@/lib/school-score-engine/weights';
import type { ScoreModuleKey } from '@/lib/school-score-engine/types';
import { isMvp3ScoresOnlyClient, visibleScoreModuleKeysClient } from '@/components/school-intelligence/scoreVisibility';

const MODULE_KPIS: { key: string; mod: ScoreModuleKey }[] = [
  { key: 'teacher', mod: 'teacher' },
  { key: 'occupancy', mod: 'occupancy' },
  { key: 'academic', mod: 'academic' },
  { key: 'staff', mod: 'staff' },
  { key: 'space', mod: 'space' },
  { key: 'discipline', mod: 'discipline' },
  { key: 'parent', mod: 'parent' },
  { key: 'compliance', mod: 'compliance' },
  { key: 'safety', mod: 'safety' },
  { key: 'security', mod: 'security' },
];

export default function SchoolIntelligenceOverviewPage() {
  const orgId = 1;
  const [filters, setFilters] = useState<SIFilters>({ organizationId: '', siteId: '', dateRange: '7d' });
  const { to: summaryDate, from } = resolveSIFilterDates(filters);
  const compareLabel = scoreCompareLabel(filters.dateRange, from, summaryDate);
  const scores = useSchoolOverallScore(orgId, summaryDate, filters.dateRange);
  const scoreCompare = useSchoolScoreCompare(orgId, filters);
  const daily = useSchoolDailyOverview(orgId, summaryDate);
  const isSchoolOrg = filters.organizationId === '' || filters.organizationId === 'demo-school';

  const mvp3Only = isMvp3ScoresOnlyClient();
  const visibleMods = new Set(visibleScoreModuleKeysClient());
  const primaryKpis = MODULE_KPIS.filter((k) => visibleMods.has(k.mod));
  const deferredKpis = MODULE_KPIS.filter((k) => !visibleMods.has(k.mod));

  const handleRefresh = useCallback(() => {
    void scores.reload();
    void scoreCompare.reload();
    void daily.reload();
  }, [scores.reload, scoreCompare.reload, daily.reload]);

  usePageHeaderRefresh(handleRefresh);

  return (
    <div className="space-y-6">
      <SchoolIntelligenceBreadcrumbs current="Overview" />
      <SIFilterBar filters={filters} onChange={setFilters} />
      {!isSchoolOrg && (
        <div className="rounded-lg border border-yellow-900/50 bg-yellow-950/30 px-4 py-3 text-sm text-yellow-200">
          School Intelligence is only available for school-type organizations.
        </div>
      )}

      <SIModuleScoreGrid
        modules={primaryKpis}
        scores={scores.data}
        dailyOverview={daily.data}
        date={summaryDate}
        compareLabel={compareLabel}
        moduleCompare={scoreCompare.data?.moduleDeltas}
        loading={scores.loading || daily.loading || scoreCompare.loading}
        mvp3Only={mvp3Only}
        deferredLabels={deferredKpis.map((k) => MODULE_LABELS[k.mod])}
      />
    </div>
  );
}
