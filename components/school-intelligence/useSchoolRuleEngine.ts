'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
const ORG = 1;

export type IntelligenceEventFilters = {
  status?: string;
  from?: string;
  to?: string;
  eventType?: string;
  zoneId?: number;
};

export function useIntelligenceEvents(filters?: IntelligenceEventFilters) {
  const q = new URLSearchParams({ organizationId: String(ORG) });
  if (filters?.status) q.set('status', filters.status);
  if (filters?.from) q.set('from', filters.from);
  if (filters?.to) q.set('to', filters.to);
  if (filters?.eventType) q.set('eventType', filters.eventType);
  if (filters?.zoneId != null) q.set('zoneId', String(filters.zoneId));
  return useQuery({
    queryKey: ['intel-events', q.toString()],
    queryFn: async () => (await fetch(`/api/intelligence-events?${q}`)).json(),
  });
}

export function useIntelligenceEvent(id: number) {
  return useQuery({
    queryKey: ['intel-event', id],
    queryFn: async () => (await fetch(`/api/intelligence-events/${id}`)).json(),
    enabled: id > 0,
  });
}

export function useIntelligenceRules() {
  return useQuery({
    queryKey: ['intel-rules', ORG],
    queryFn: async () => (await fetch(`/api/intelligence-rules?organizationId=${ORG}`)).json(),
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

export function useEvaluateRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/school-rule-engine/evaluate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organizationId: ORG }),
      });
      if (!res.ok) throw new Error('Evaluate failed');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['intel-events'] }),
  });
}
