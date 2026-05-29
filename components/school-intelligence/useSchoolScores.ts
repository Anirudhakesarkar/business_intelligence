'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DailyOverallScore, ScoreModuleKey } from '@/lib/school-score-engine/types';
import {
  priorPeriodEndDate,
  resolveSIFilterDates,
} from '@/lib/school-intelligence/date-range';
import {
  buildDemoOverallScore,
  buildDemoScoreCompare,
  isSchoolScoreDemoEnabled,
  mergeWithDemoCompare,
  mergeWithDemoOverall,
  type ModuleScoreCompare,
} from '@/lib/school-intelligence/module-score-demo';
import type { SIFilters } from '@/lib/school-intelligence/types';
import { visibleScoreModuleKeysClient } from '@/components/school-intelligence/scoreVisibility';

export type { ModuleScoreCompare };

export type SchoolScoreCompare = {
  date: string;
  priorDate: string;
  moduleDeltas: ModuleScoreCompare[];
};

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function useSchoolOverallScore(
  organizationId = 1,
  date = todayIso(),
  dateRange: SIFilters['dateRange'] = '7d'
) {
  const [data, setData] = useState<DailyOverallScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const visibleModules = useMemo(
    () => visibleScoreModuleKeysClient() as ScoreModuleKey[],
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/school-scores/overall?organizationId=${organizationId}&date=${encodeURIComponent(date)}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load scores');
      const live = json.overallScore != null ? (json as DailyOverallScore) : null;
      if (isSchoolScoreDemoEnabled()) {
        setData(mergeWithDemoOverall(live, date, dateRange, visibleModules));
      } else {
        setData(live);
      }
    } catch (e) {
      if (isSchoolScoreDemoEnabled()) {
        setData(buildDemoOverallScore(date, dateRange, visibleModules));
        setError(null);
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [organizationId, date, dateRange, visibleModules]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}

export function useSchoolScoreCompare(organizationId = 1, filters: SIFilters) {
  const { from, to } = useMemo(() => resolveSIFilterDates(filters), [filters]);
  const priorDate = useMemo(() => priorPeriodEndDate(from, to), [from, to]);

  const [data, setData] = useState<SchoolScoreCompare | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const visibleModules = useMemo(
    () => visibleScoreModuleKeysClient() as ScoreModuleKey[],
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        organizationId: String(organizationId),
        date: to,
        priorDate,
      });
      if (filters.siteId) q.set('siteId', filters.siteId);
      const res = await fetch(`/api/school-scores/overall/compare?${q}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load score comparison');
      const liveDeltas = (json.moduleDeltas ?? []) as ModuleScoreCompare[];
      const moduleDeltas = isSchoolScoreDemoEnabled()
        ? mergeWithDemoCompare(liveDeltas, filters.dateRange, visibleModules)
        : liveDeltas;
      setData({
        date: json.date ?? to,
        priorDate: json.priorDate ?? priorDate,
        moduleDeltas,
      });
    } catch (e) {
      if (isSchoolScoreDemoEnabled()) {
        setData(buildDemoScoreCompare(to, priorDate, filters.dateRange, visibleModules));
        setError(null);
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load comparison');
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [organizationId, to, priorDate, filters.siteId, filters.dateRange, visibleModules]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load, periodEnd: to, periodStart: from, priorDate };
}
