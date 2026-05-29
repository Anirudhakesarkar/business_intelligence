'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type IntelligenceEventFilters = {
  organizationId?: number;
  status?: string;
  from?: string;
  to?: string;
  eventType?: string;
  zoneId?: number;
  siteId?: number;
};

export function useIntelligenceEvents(filters?: IntelligenceEventFilters) {
  const organizationId = filters?.organizationId ?? 1;
  const q = new URLSearchParams({ organizationId: String(organizationId) });
  if (filters?.status) q.set('status', filters.status);
  if (filters?.from) q.set('from', filters.from);
  if (filters?.to) q.set('to', filters.to);
  if (filters?.eventType) q.set('eventType', filters.eventType);
  if (filters?.zoneId != null) q.set('zoneId', String(filters.zoneId));
  if (filters?.siteId != null) q.set('siteId', String(filters.siteId));
  return useQuery({
    queryKey: ['intel-events', q.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/intelligence-events?${q}`);
      if (!res.ok) throw new Error(`Events API returned ${res.status}`);
      return res.json();
    },
  });
}

export function useIntelligenceEvent(id: number) {
  return useQuery({
    queryKey: ['intel-event', id],
    queryFn: async () => {
      const res = await fetch(`/api/intelligence-events/${id}`);
      if (!res.ok) throw new Error(`Event API returned ${res.status}`);
      return res.json();
    },
    enabled: id > 0,
  });
}

export function useIntelligenceRules(organizationId = 1) {
  return useQuery({
    queryKey: ['intel-rules', organizationId],
    queryFn: async () => (await fetch(`/api/intelligence-rules?organizationId=${organizationId}`)).json(),
  });
}

export function useSeedRuleEngine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/school-rule-engine/seed', { method: 'POST' });
      if (!res.ok) throw new Error('Seed failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['intel-events'] });
      qc.invalidateQueries({ queryKey: ['intel-rules'] });
    },
  });
}

export function useEvaluateRules(organizationId = 1) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/school-rule-engine/evaluate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) throw new Error('Evaluate failed');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['intel-events'] }),
  });
}
