'use client';
import { schoolFetch } from '@/lib/school-auth/client-fetch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const ORG = 1;

export function useSetupHealth() {
  return useQuery({
    queryKey: ['sm-setup-health', ORG],
    queryFn: async () => {
      const res = await schoolFetch(`/api/school-management/setup-health?organizationId=${ORG}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });
}

export function useSeedDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await schoolFetch('/api/school-management/seed', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? 'Seed failed');
      return body;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-setup-health'] });
      void qc.invalidateQueries({ queryKey: ['sm-sites'] });
      void qc.invalidateQueries({ queryKey: ['sm-buildings-all'] });
      void qc.invalidateQueries({ queryKey: ['sm-floors-all'] });
      void qc.invalidateQueries({ queryKey: ['sm-zones-all'] });
      void qc.invalidateQueries({ queryKey: ['sm-rooms'] });
      void qc.invalidateQueries({ queryKey: ['sm-classes'] });
      void qc.invalidateQueries({ queryKey: ['sm-sections'] });
      void qc.invalidateQueries({ queryKey: ['sm-subjects'] });
      void qc.invalidateQueries({ queryKey: ['sm-teachers'] });
      void qc.invalidateQueries({ queryKey: ['sm-staff'] });
      void qc.invalidateQueries({ queryKey: ['sm-cameras'] });
      void qc.invalidateQueries({ queryKey: ['sm-timetable'] });
      void qc.invalidateQueries({ queryKey: ['sm-calendar'] });
      void qc.invalidateQueries({ queryKey: ['sm-roster'] });
    },
  });
}

export function useMissingData() {
  return useQuery({
    queryKey: ['sm-missing-data', ORG],
    queryFn: async () => {
      const res = await schoolFetch(`/api/school-management/missing-data?organizationId=${ORG}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });
}

export function useCameras() {
  return useQuery({
    queryKey: ['sm-cameras', ORG],
    queryFn: async () => (await schoolFetch(`/api/cameras?organizationId=${ORG}`)).json(),
  });
}

export function useRooms() {
  return useQuery({
    queryKey: ['sm-rooms', ORG],
    queryFn: async () => (await schoolFetch(`/api/rooms?organizationId=${ORG}`)).json(),
  });
}

export function useTimetable() {
  return useQuery({
    queryKey: ['sm-timetable', ORG],
    queryFn: async () => (await schoolFetch(`/api/timetable?organizationId=${ORG}`)).json(),
  });
}

export function useCalendar() {
  return useQuery({
    queryKey: ['sm-calendar', ORG],
    queryFn: async () => (await schoolFetch(`/api/school-calendar?organizationId=${ORG}`)).json(),
  });
}

export function useRoster() {
  return useQuery({
    queryKey: ['sm-roster', ORG],
    queryFn: async () => (await schoolFetch(`/api/staff-duty-rosters?organizationId=${ORG}`)).json(),
  });
}

export function useZones() {
  return useQuery({
    queryKey: ['sm-zones', ORG],
    queryFn: async () => (await fetch(`/api/zones?organizationId=${ORG}`)).json(),
  });
}

export function useSites() {
  return useQuery({
    queryKey: ['sm-sites', ORG],
    queryFn: async () => (await fetch(`/api/sites?organizationId=${ORG}`)).json(),
  });
}

export function useTeachers() {
  return useQuery({
    queryKey: ['sm-teachers', ORG],
    queryFn: async () => (await fetch(`/api/teachers?organizationId=${ORG}`)).json(),
  });
}

export function useSections() {
  return useQuery({
    queryKey: ['sm-sections', ORG],
    queryFn: async () => (await fetch(`/api/sections?organizationId=${ORG}`)).json(),
  });
}

export function useComplianceConfig() {
  return useQuery({
    queryKey: ['sm-compliance', ORG],
    queryFn: async () => (await fetch(`/api/organizations/${ORG}/compliance-config`)).json(),
  });
}

export function useInvalidateSM() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['sm-'] });
    qc.invalidateQueries({ queryKey: ['sm-setup-health'] });
  };
}

