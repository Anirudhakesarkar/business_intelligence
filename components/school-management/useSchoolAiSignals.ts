'use client';
import { schoolFetch } from '@/lib/school-auth/client-fetch';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
const ORG = 1;
export function useAiHealth() {
  return useQuery({ queryKey: ['ai-health', ORG], queryFn: async () => (await schoolFetch(`/api/school-ai-signals/health?organizationId=${ORG}`)).json() });
}
export function useAiWorkers() {
  return useQuery({ queryKey: ['ai-workers'], queryFn: async () => (await schoolFetch('/api/school-ai-signals/workers')).json() });
}
export function useSignalTimeline(params?: { cameraId?: number }) {
  const q = new URLSearchParams({ organizationId: String(ORG) });
  if (params?.cameraId) q.set('cameraId', String(params.cameraId));
  return useQuery({ queryKey: ['ai-signals', q.toString()], queryFn: async () => (await schoolFetch(`/api/school-ai-signals/signals?${q}`)).json() });
}
export function useCameraAiDetail(cameraId: number) {
  return useQuery({ queryKey: ['ai-camera', cameraId], queryFn: async () => (await schoolFetch(`/api/school-ai-signals/cameras/${cameraId}`)).json(), enabled: cameraId > 0 });
}
export function useSeedAiSignals() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async () => { const res = await schoolFetch('/api/school-ai-signals/seed', { method: 'POST' }); if (!res.ok) throw new Error('Seed failed'); return res.json(); }, onSuccess: () => { qc.invalidateQueries({ queryKey: ['ai-health'] }); qc.invalidateQueries({ queryKey: ['ai-workers'] }); qc.invalidateQueries({ queryKey: ['ai-signals'] }); } });
}
