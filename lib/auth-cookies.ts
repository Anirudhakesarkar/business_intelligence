/** HttpOnly cookies scoped to /api — not readable from browser JS (XSS mitigation). */
export const AUTH_COOKIE_PATH = '/api';

export const COOKIE_REFRESH = 'vms_refresh_token';
export const COOKIE_API_BASE = 'vms_api_base';
export const COOKIE_SITE_ID = 'vms_site_id';

export function authCookieOptions(maxAgeSec: number): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: AUTH_COOKIE_PATH,
    maxAge: maxAgeSec,
  };
}

export const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
