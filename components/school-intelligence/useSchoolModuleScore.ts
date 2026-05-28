'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ScoreModuleKey, ScoreDriver } from '@/lib/school-score-engine/types';

export function useSchoolModuleScore(
  moduleKey: ScoreModuleKey | undefined,
  organizationId = 1,
  date: string
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
      const [detailRes, trendRes] = await Promise.all([
        fetch(
          `/api/school-scores/modules/${moduleKey}?organizationId=${organizationId}&date=${encodeURIComponent(date)}`
        ),
        fetch(
          `/api/school-scores/modules/${moduleKey}/trend?organizationId=${organizationId}&date=${encodeURIComponent(date)}&days=7`
        ),
      ]);
      const detailJson = await detailRes.json();
      if (!detailRes.ok) {
        throw new Error(detailJson.error ?? 'Failed to load module score');
      }
      const trendJson = await trendRes.json();
      if (!trendRes.ok) {
        throw new Error(trendJson.error ?? 'Failed to load module trend');
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
  }, [moduleKey, organizationId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  return { score, drivers, priorScore, delta, trend, loading, error, reload: load };
}
