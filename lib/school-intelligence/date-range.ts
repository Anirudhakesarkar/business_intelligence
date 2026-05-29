import type { SIDateRange, SIFilters } from './types';

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function presetDateBounds(
  preset: Exclude<SIDateRange, 'custom'>,
  endDate = todayIso(),
): { from: string; to: string } {
  const end = new Date(`${endDate}T12:00:00`);
  const start = new Date(end);
  if (preset === '24h') {
    start.setTime(start.getTime() - 24 * 60 * 60 * 1000);
    return { from: start.toISOString().slice(0, 10), to: endDate };
  }
  const days = preset === '30d' ? 30 : 7;
  start.setDate(start.getDate() - days);
  return { from: start.toISOString().slice(0, 10), to: endDate };
}

/** Resolved inclusive calendar bounds for API queries. */
export function resolveSIFilterDates(filters: SIFilters): { from: string; to: string } {
  if (filters.dateRange === 'custom') {
    const to = filters.dateTo || todayIso();
    const from = filters.dateFrom || to;
    return from <= to ? { from, to } : { from: to, to: from };
  }
  return presetDateBounds(filters.dateRange);
}

/** Inclusive day count between two ISO dates. */
export function periodLengthDays(from: string, to: string): number {
  const fromD = new Date(`${from}T12:00:00`);
  const toD = new Date(`${to}T12:00:00`);
  const diff = Math.round((toD.getTime() - fromD.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(1, diff + 1);
}

/** End date of the comparison period immediately before `from`. */
export function priorPeriodEndDate(from: string, to: string): string {
  const len = periodLengthDays(from, to);
  const anchor = new Date(`${from}T12:00:00`);
  anchor.setDate(anchor.getDate() - len);
  return anchor.toISOString().slice(0, 10);
}

export function scoreCompareLabel(dateRange: SIDateRange, from: string, to: string): string {
  if (dateRange === '24h') return 'vs prior 24 hours';
  if (dateRange === '7d') return 'vs prior 7 days';
  if (dateRange === '30d') return 'vs prior 30 days';
  const days = periodLengthDays(from, to);
  return days === 1 ? 'vs prior day' : `vs prior ${days} days`;
}
