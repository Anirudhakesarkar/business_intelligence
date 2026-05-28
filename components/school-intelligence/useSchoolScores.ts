'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DailyOverallScore } from '@/lib/school-score-engine/types';

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function useSchoolOverallScore(organizationId = 1, date = todayIso()) {
  const [data, setData] = useState<DailyOverallScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/school-scores/overall?organizationId=${organizationId}&date=${encodeURIComponent(date)}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load scores');
      setData(json.overallScore != null ? json : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [organizationId, date]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
