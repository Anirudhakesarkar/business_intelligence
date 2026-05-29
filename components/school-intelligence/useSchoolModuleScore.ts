'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchJsonStrict } from '@/lib/school-intelligence/fetch-json';
import type { ScoreModuleKey, ScoreDriver } from '@/lib/school-score-engine/types';

type ModuleScoreDetail = {
  score?: number | null;
  top_drivers?: ScoreDriver[];
  drivers?: ScoreDriver[];
  priorScore?: number | null;
  trend_delta?: number | null;
  error?: string;
};

type ModuleTrend = {
  points?: { date: string; score: number }[];
  error?: string;
};

export function useSchoolModuleScore(
  moduleKey: ScoreModuleKey | undefined,
  organizationId = 1,
  date: string,
  siteId?: string,
) {
  const [score, setScore] = useState<number | null>(null);
  const [drivers, setDrivers] = useState<ScoreDriver[]>([]);
  const [priorScore, setPriorScore] = useState<number | null>(null);
  const [delta, setDelta] = useState<number | null>(null);
  const [trend, setTrend] = useState<{ date: string; score: number }[]>([]);
  const [loading, setLoading] = useState(!!moduleKey);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!moduleKey) {
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const siteQ = siteId ? `&siteId=${encodeURIComponent(siteId)}` : '';
      const detailJson = await fetchJsonStrict<ModuleScoreDetail>(
        `/api/school-scores/modules/${moduleKey}?organizationId=${organizationId}&date=${encodeURIComponent(date)}${siteQ}`,
      );
      const trendJson = await fetchJsonStrict<ModuleTrend>(
        `/api/school-scores/modules/${moduleKey}/trend?organizationId=${organizationId}&date=${encodeURIComponent(date)}&days=7${siteQ}`,
      );
      if (detailJson.error) {
        throw new Error(detailJson.error);
      }
      setScore(detailJson.score ?? null);
      setDrivers(detailJson.top_drivers ?? detailJson.drivers ?? []);
      setPriorScore(detailJson.priorScore ?? null);
      setDelta(detailJson.trend_delta ?? null);
      setTrend(trendJson.points ?? []);
    } catch (e) {
      setScore(null);
      setDrivers([]);
      setPriorScore(null);
      setDelta(null);
      setTrend([]);
      setError(e instanceof Error ? e.message : 'Failed to load module score');
    } finally {
      setLoading(false);
    }
  }, [moduleKey, organizationId, date, siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { score, drivers, priorScore, delta, trend, loading, error, reload: load };
}
