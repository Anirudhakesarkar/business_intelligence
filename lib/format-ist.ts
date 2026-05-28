const IST_TIME_ZONE = 'Asia/Kolkata';

const IST_FORMAT: Intl.DateTimeFormatOptions = {
  timeZone: IST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
};

/** Parse API timestamps stored as UTC (with or without Z suffix). */
export function parseUtcTimestamp(value: string | null | undefined): Date | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const normalized =
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(trimmed) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)
      ? `${trimmed.replace(' ', 'T')}Z`
      : trimmed;

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Format a UTC timestamp for display in Indian Standard Time. */
export function formatUtcAsIst(
  value: string | null | undefined,
  fallback = '—',
): string {
  const date = parseUtcTimestamp(value);
  if (!date) return fallback;

  const parts = new Intl.DateTimeFormat('en-IN', IST_FORMAT).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')} IST`;
}
