
import type { BellPeriod, SiteBellSchedule } from './types';
import { BELL_SCHEDULE_LS_KEY } from './constants';

const DEFAULT_PERIODS: BellPeriod[] = [
  { id: 'p1', label: 'Period 1', startTime: '08:00', endTime: '08:45', isBreak: false },
  { id: 'p2', label: 'Period 2', startTime: '08:50', endTime: '09:35', isBreak: false },
  { id: 'break1', label: 'Short Break', startTime: '09:35', endTime: '09:50', isBreak: true },
  { id: 'p3', label: 'Period 3', startTime: '09:50', endTime: '10:35', isBreak: false },
  { id: 'lunch', label: 'Lunch', startTime: '12:00', endTime: '12:45', isBreak: true },
];

export function defaultBellSchedule(siteId = 'site-main'): SiteBellSchedule {
  const weekdays: Record<string, BellPeriod[]> = {};
  for (const d of ['1', '2', '3', '4', '5']) weekdays[d] = DEFAULT_PERIODS;
  return { siteId, timezone: 'Asia/Kolkata', weekdays };
}

export function loadBellScheduleFromStorage(siteId: string): SiteBellSchedule | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BELL_SCHEDULE_LS_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, SiteBellSchedule>;
    return all[siteId] ?? null;
  } catch {
    return null;
  }
}

export function saveBellScheduleToStorage(schedule: SiteBellSchedule): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(BELL_SCHEDULE_LS_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, SiteBellSchedule>) : {};
    all[schedule.siteId] = schedule;
    localStorage.setItem(BELL_SCHEDULE_LS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function getCurrentPeriod(schedule: SiteBellSchedule, now = new Date()): BellPeriod | null {
  const day = String(now.getDay() || 7);
  const periods = schedule.weekdays[day] ?? [];
  const hhmm = now.toTimeString().slice(0, 5);
  return periods.find((p) => p.startTime <= hhmm && hhmm < p.endTime) ?? null;
}
