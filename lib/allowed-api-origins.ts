/**
 * Restrict which backend origins the dashboard may call (SSRF mitigation for /api/proxy and BFF routes).
 *
 * Set ALLOWED_API_ORIGINS to a comma-separated list of origins, e.g.:
 *   http://127.0.0.1:8788,https://api.example.com
 *
 * In production, if unset, no origins are allowed (fail closed).
 * In development, localhost / 127.0.0.1 on any port are allowed when unset.
 */
export function normalizeApiOrigin(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

export function isAllowedApiOrigin(serverUrl: string): boolean {
  const normalized = normalizeApiOrigin(serverUrl);
  if (!normalized) return false;

  const env = process.env.ALLOWED_API_ORIGINS?.trim();
  if (env) {
    const allowed = new Set(
      env
        .split(',')
        .map((s) => normalizeApiOrigin(s))
        .filter((x): x is string => !!x)
    );
    return allowed.has(normalized);
  }

  if (process.env.NODE_ENV !== 'production') {
    return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(normalized);
  }

  return false;
}
