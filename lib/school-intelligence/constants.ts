import type { SIDateRange } from './types';

export const DATE_RANGE_OPTIONS: { value: SIDateRange; label: string }[] = [
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
];

export const SCHOOL_INDUSTRY = 'School';

export const BELL_SCHEDULE_LS_KEY = 'si-bell-schedule-v1';
