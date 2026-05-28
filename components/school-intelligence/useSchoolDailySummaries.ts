'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DailySummaryModule } from '@/lib/school-daily-summaries/types';
import type { EventType } from '@/lib/school-rule-engine/types';

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type ModuleSummary = {
  module: string;
  label: string;
  date: string;
  organizationId: number;
  rows: unknown[];
  headlineMetrics: Record<string, number | string | null>;
  facts: { text: string; metricKey?: string; eventTypes?: string[] }[];
};

type Overview = {
  organizationId: number;
  date: string;
  modules: { module: string; label: string; rowCount: number; headlineMetrics: Record<string, number | string | null>; facts: { text: string }[] }[];
  scoreInputs?: { inputsJson?: Record<string, unknown>; facts?: { text: string }[] };
};

export function useSchoolDailyOverview(organizationId = 1, date = todayIso()) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/daily-summaries/overview?organizationId=${organizationId}&date=${encodeURIComponent(date)}`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  }, [organizationId, date]);
  useEffect(() => { void load(); }, [load]);
  return { data, loading, error, reload: load };
}

export function useSchoolDailyModule(module: DailySummaryModule, organizationId = 1, date = todayIso()) {
  const [data, setData] = useState<ModuleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/daily-summaries/${module}?organizationId=${organizationId}&date=${encodeURIComponent(date)}`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  }, [module, organizationId, date]);
  useEffect(() => { void load(); }, [load]);
  return { data, loading, error, reload: load };
}

export function eventsDrilldownHref(module: DailySummaryModule, date: string, metricKey?: string, eventTypes?: EventType[]) {
  const q = new URLSearchParams({ date, module });
  if (eventTypes?.[0]) q.set('eventType', eventTypes[0]);
  else if (metricKey) q.set('metric', metricKey);
  return `/dashboard/school-intelligence/events?${q.toString()}`;
}
