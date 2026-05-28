import type { NextRequest } from 'next/server';

/**
 * Simple in-memory fixed-window rate limiter per Next.js process.
 * For multiple instances behind a load balancer, use Redis (@upstash/ratelimit) instead.
 */

const WINDOW_MS = 60_000;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function pruneIfLarge() {
  if (buckets.size < 5000) return;
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (now >= v.resetAt) buckets.delete(k);
  }
}

export function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim() || 'unknown';
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

/**
 * @returns allowed, or retryAfterSec for HTTP 429 Retry-After
 */
export function rateLimit(
  key: string,
  maxPerWindow: number
): { allowed: true } | { allowed: false; retryAfterSec: number } {
  if (Math.random() < 0.02) pruneIfLarge();

  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }
  if (b.count >= maxPerWindow) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  b.count += 1;
  return { allowed: true };
}

/** Failed login / password attempts (stricter). Default 10/min/IP. */
export function loginRateLimitKey(ip: string): string {
  return `auth:login:${ip}`;
}

/** Session refresh (looser — can spike on parallel requests). Default 30/min/IP. */
export function refreshRateLimitKey(ip: string): string {
  return `auth:refresh:${ip}`;
}

export function getLoginLimit(): number {
  const n = parseInt(process.env.AUTH_RATE_LIMIT_LOGIN_PER_MIN || '10', 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

export function getRefreshLimit(): number {
  const n = parseInt(process.env.AUTH_RATE_LIMIT_REFRESH_PER_MIN || '30', 10);
  return Number.isFinite(n) && n > 0 ? n : 30;
}
