'use client';

import { getConfig } from '@/app/lib/config';

/** Attach session Bearer token for school intelligence APIs when SCHOOL_RBAC=1. */
export function schoolAuthHeaders(): Record<string, string> {
  const cfg = getConfig();
  if (cfg?.token) return { Authorization: `Bearer ${cfg.token}` };
  return {};
}

export function schoolFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers: {
      ...schoolAuthHeaders(),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}
