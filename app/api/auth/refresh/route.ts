import { NextRequest, NextResponse } from 'next/server';
import { isAllowedApiOrigin, normalizeApiOrigin } from '@/lib/allowed-api-origins';
import {
  authCookieOptions,
  COOKIE_API_BASE,
  COOKIE_REFRESH,
  COOKIE_SITE_ID,
  REFRESH_COOKIE_MAX_AGE,
  AUTH_COOKIE_PATH,
} from '@/lib/auth-cookies';
import {
  getClientIp,
  getRefreshLimit,
  rateLimit,
  refreshRateLimitKey,
} from '@/lib/auth-rate-limit';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = rateLimit(refreshRateLimitKey(ip), getRefreshLimit());
    if (!rl.allowed) {
      const res = NextResponse.json(
        { ok: false, error: 'Too many refresh attempts. Try again later.' },
        { status: 429 }
      );
      res.headers.set('Retry-After', String(rl.retryAfterSec));
      return res;
    }

    const refreshToken = request.cookies.get(COOKIE_REFRESH)?.value;
    const apiBaseRaw = request.cookies.get(COOKIE_API_BASE)?.value;
    const siteIdCookie = request.cookies.get(COOKIE_SITE_ID)?.value;

    if (!refreshToken || !apiBaseRaw) {
      return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });
    }

    if (!isAllowedApiOrigin(apiBaseRaw)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const base = normalizeApiOrigin(apiBaseRaw);
    if (!base) {
      return NextResponse.json({ ok: false, error: 'Invalid session' }, { status: 401 });
    }

    const res = await fetch(`${base}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    const json = (await res.json()) as {
      ok?: boolean;
      error?: string;
      token?: string;
      refresh_token?: string;
      user?: { site_ids?: string[]; [k: string]: unknown };
    };

    if (!res.ok || !json.ok || !json.token || !json.refresh_token || !json.user) {
      const out = NextResponse.json(
        { ok: false, error: json.error || 'Session expired' },
        { status: res.status >= 400 ? res.status : 401 }
      );
      clearAuthCookies(out);
      return out;
    }

    const siteId =
      siteIdCookie ||
      (json.user.site_ids?.[0] as string | undefined) ||
      'site_local';
    const opts = authCookieOptions(REFRESH_COOKIE_MAX_AGE);
    const out = NextResponse.json({
      ok: true,
      token: json.token,
      user: json.user,
      serverUrl: base,
      siteId,
    });

    out.cookies.set(COOKIE_REFRESH, json.refresh_token, opts);
    out.cookies.set(COOKIE_API_BASE, base, opts);
    out.cookies.set(COOKIE_SITE_ID, siteId, opts);

    return out;
  } catch (error) {
    console.error('[auth/refresh]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Refresh failed' },
      { status: 500 }
    );
  }
}

function clearAuthCookies(res: NextResponse) {
  const z = { path: AUTH_COOKIE_PATH, maxAge: 0 };
  res.cookies.set(COOKIE_REFRESH, '', z);
  res.cookies.set(COOKIE_API_BASE, '', z);
  res.cookies.set(COOKIE_SITE_ID, '', z);
}
