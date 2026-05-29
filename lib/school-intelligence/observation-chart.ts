import {
  periodLengthDays,
  resolveSIFilterDates,
  resolveSIFilterInstantBounds,
} from '@/lib/school-intelligence/date-range';
import type { SIFilters } from '@/lib/school-intelligence/types';
import type { ObservationBucket } from '@/lib/school-intelligence/module-standard/types';

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeekday(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function formatMonthLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export function buildObservationBuckets(
  filters: SIFilters,
): Omit<ObservationBucket, 'count'>[] {
  const { from, to } = resolveSIFilterDates(filters);
  const dayCount = periodLengthDays(from, to);

  if (filters.dateRange === '24h') {
    const end = Date.now();
    return Array.from({ length: 12 }).map((_, i) => {
      const slotEnd = new Date(end - (11 - i) * 2 * 60 * 60 * 1000);
      const label = slotEnd.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return { key: `h-${i}`, label };
    });
  }

  if (dayCount <= 31) {
    const buckets: Omit<ObservationBucket, 'count'>[] = [];
    let cur = from;
    while (cur <= to) {
      buckets.push({
        key: cur,
        label: formatDayLabel(cur),
        subLabel: formatWeekday(cur),
      });
      cur = addDays(cur, 1);
    }
    return buckets;
  }

  const buckets: Omit<ObservationBucket, 'count'>[] = [];
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({ key, label: formatMonthLabel(`${key}-01`) });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

export function countObservationsInBucket(
  observations: { startedAt: string }[],
  bucketKey: string,
  filters: SIFilters,
): number {
  if (filters.dateRange === '24h') {
    const slotIndex = Number(bucketKey.replace('h-', ''));
    const { to: endIso } = resolveSIFilterInstantBounds(filters);
    const endMs = new Date(endIso).getTime();
    const slotEnd = endMs - (11 - slotIndex) * 2 * 60 * 60 * 1000;
    const slotStart = slotEnd - 2 * 60 * 60 * 1000;
    return observations.filter((e) => {
      const t = new Date(e.startedAt).getTime();
      return t >= slotStart && t < slotEnd;
    }).length;
  }

  if (bucketKey.includes('-') && bucketKey.length === 7) {
    return observations.filter((e) => e.startedAt.slice(0, 7) === bucketKey).length;
  }

  return observations.filter((e) => e.startedAt.slice(0, 10) === bucketKey).length;
}

export function buildObservationChartData(
  observations: { startedAt: string }[],
  filters: SIFilters,
): ObservationBucket[] {
  const buckets = buildObservationBuckets(filters);
  return buckets.map((b) => ({
    ...b,
    count: countObservationsInBucket(observations, b.key, filters),
  }));
}
