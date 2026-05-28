import { NextRequest, NextResponse } from 'next/server';
import { isAllowedApiOrigin, normalizeApiOrigin } from '@/lib/allowed-api-origins';
import { COOKIE_API_BASE, COOKIE_SITE_ID } from '@/lib/auth-cookies';

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

/** Prefer IPv4 loopback for outbound fetch — avoids ::1 vs 127.0.0.1 bind mismatches on some hosts. */
function fetchOriginPreferIpv4(origin: string): string {
  try {
    const u = new URL(origin.endsWith('/') ? origin : `${origin}/`);
    if (u.hostname === 'localhost') u.hostname = '127.0.0.1';
    return u.origin;
  } catch {
    return origin;
  }
}

function flattenFetchFailure(err: unknown): string {
  const parts: string[] = [];
  let e: unknown = err;
  let depth = 0;
  while (e != null && depth++ < 12) {
    if (e instanceof AggregateError && Array.isArray(e.errors)) {
      for (const sub of e.errors) {
        parts.push(sub instanceof Error ? sub.message : String(sub));
      }
      break;
    }
    if (e instanceof Error) {
      parts.push(e.message);
      e = e.cause;
    } else {
      parts.push(String(e));
      break;
    }
  }
  return parts.join(' | ');
}

function isUnreachableBackendError(errMsg: string): boolean {
  const m = errMsg.toLowerCase();
  return (
    m.includes('econnrefused') ||
    m.includes('fetch failed') ||
    m.includes('enotfound') ||
    m.includes('etimedout') ||
    m.includes('econnreset') ||
    m.includes('socket hang up') ||
    (m.includes('network') && m.includes('unreachable'))
  );
}



export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      serverUrl: bodyServerUrl,
      path,
      method = 'GET',
      siteId: bodySiteId,
      apiKey,
      token,
      body: requestBody,
    } = body as {
      serverUrl?: string;
      path?: string;
      method?: string;
      siteId?: string;
      apiKey?: string;
      token?: string;
      body?: unknown;
    };

    const m = typeof method === 'string' ? method.toUpperCase() : 'GET';
    if (!ALLOWED_METHODS.has(m)) {
      return NextResponse.json({ error: 'Method not allowed' }, { status: 400 });
    }

    const pathOk =
      typeof path === 'string' &&
      (path.startsWith('/v1/') || path.startsWith('/api/'));
    if (!pathOk) {
      return NextResponse.json(
        { error: 'path must start with /v1/ or /api/' },
        { status: 400 },
      );
    }

    const cookieBase = request.cookies.get(COOKIE_API_BASE)?.value;
    const cookieSiteId = request.cookies.get(COOKIE_SITE_ID)?.value;
    const siteId = (typeof bodySiteId === 'string' && bodySiteId) || cookieSiteId;

    const hasToken = token && typeof token === 'string';
    const hasApiKey = apiKey && typeof apiKey === 'string' && siteId && typeof siteId === 'string';
    if (!hasToken && !hasApiKey) {
      return NextResponse.json({ error: 'Either token or (apiKey + siteId) is required' }, { status: 400 });
    }

    // Prefer explicit serverUrl from the client body (localStorage / Settings). Stale HttpOnly
    // COOKIE_API_BASE from an older login must NOT override — that caused proxy to call the wrong host → ECONNREFUSED → 503.
    const trimmedBody =
      typeof bodyServerUrl === 'string' && bodyServerUrl.trim() ? bodyServerUrl.trim() : undefined;
    const serverUrlRaw = trimmedBody || (hasToken ? cookieBase : undefined) || cookieBase;
    if (!serverUrlRaw || typeof serverUrlRaw !== 'string') {
      return NextResponse.json({ error: 'serverUrl is required' }, { status: 400 });
    }
    if (!isAllowedApiOrigin(serverUrlRaw)) {
      return NextResponse.json({ error: 'Server URL is not allowed' }, { status: 403 });
    }

    const base = normalizeApiOrigin(serverUrlRaw);
    if (!base) {
      return NextResponse.json({ error: 'Invalid serverUrl' }, { status: 400 });
    }

    const upstreamOrigin = fetchOriginPreferIpv4(base);
    const url = `${upstreamOrigin}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (hasToken) headers['Authorization'] = `Bearer ${token}`;
      if (apiKey) headers['X-API-Key'] = apiKey;
      if (siteId) headers['X-Site-Id'] = siteId;

      const response = await fetch(url, {
        method: m,
        headers,
        body: m === 'GET' || m === 'DELETE' ? undefined : requestBody ? JSON.stringify(requestBody) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const contentType = response.headers.get('content-type');
      const isJson = contentType?.includes('application/json');

      const data = isJson ? await response.json() : await response.text();

      return NextResponse.json(
        { ok: response.ok, status: response.status, data },
        { status: response.status }
      );
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout. Is the server running?' },
          { status: 504 }
        );
      }
      const flat = flattenFetchFailure(fetchError);
      if (isUnreachableBackendError(flat)) {
        return NextResponse.json(
          {
            error:
              'Backend unreachable. Start the API server from the repo `server` folder (`npm run dev`, listens on port 8788 by default). Ensure dashboard Settings / login Server URL matches (e.g. http://127.0.0.1:8788).',
            code: 'BACKEND_UNREACHABLE',
            detail: process.env.NODE_ENV !== 'production' ? flat : undefined,
          },
          { status: 503 }
        );
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('Proxy error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
