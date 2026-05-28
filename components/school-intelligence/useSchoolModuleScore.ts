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

  const load = useCallback(async () => {
    if (!moduleKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [detailRes, trendRes] = await Promise.all([
        fetch(
          `/api/school-scores/modules/${moduleKey}?organizationId=${organizationId}&date=${encodeURIComponent(date)}`
        ),
        fetch(
          `/api/school-scores/modules/${moduleKey}/trend?organizationId=${organizationId}&date=${encodeURIComponent(date)}&days=7`
        ),
      ]);
      const data = await detailRes.json();
      setScore(data.score ?? null);
      setDrivers(data.top_drivers ?? data.drivers ?? []);
      setPriorScore(data.priorScore ?? null);
      setDelta(data.trend_delta ?? null);
      const trendData = await trendRes.json();
      setTrend(trendData.points ?? []);
    } finally {
      setLoading(false);
    }
  }, [moduleKey, organizationId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  return { score, drivers, priorScore, delta, trend, loading, reload: load };
}
