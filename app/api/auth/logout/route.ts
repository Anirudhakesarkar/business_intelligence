import { NextRequest, NextResponse } from 'next/server';
import { normalizeApiOrigin } from '@/lib/allowed-api-origins';
import { AUTH_COOKIE_PATH, COOKIE_API_BASE, COOKIE_REFRESH, COOKIE_SITE_ID } from '@/lib/auth-cookies';

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(COOKIE_REFRESH)?.value;
  const apiBaseRaw = request.cookies.get(COOKIE_API_BASE)?.value;

  if (refreshToken && apiBaseRaw) {
    const base = normalizeApiOrigin(apiBaseRaw);
    if (base) {
      try {
        await fetch(`${base}/v1/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch {
        /* still clear cookies */
      }
    }
  }

  const out = NextResponse.json({ ok: true });
  const z = { path: AUTH_COOKIE_PATH, maxAge: 0 };
  out.cookies.set(COOKIE_REFRESH, '', z);
  out.cookies.set(COOKIE_API_BASE, '', z);
  out.cookies.set(COOKIE_SITE_ID, '', z);
  return out;
}
