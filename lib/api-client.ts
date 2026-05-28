import type { Config } from '@/lib/types';
import { setConfig, clearConfig } from '@/app/lib/config';

const API_TIMEOUT = 15_000;

/** Exchange HttpOnly refresh cookie for new access token (BFF `/api/auth/refresh`). */
async function tryRefresh(currentConfig: Config): Promise<Config | null> {
  if (currentConfig.apiKey && !currentConfig.token) return null;
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    const json = (await res.json()) as {
      ok?: boolean;
      token?: string;
      user?: Config['user'];
      serverUrl?: string;
      siteId?: string;
    };
    if (!res.ok || !json.ok || !json.token || !json.user) return null;
    const newConfig: Config = {
      ...currentConfig,
      serverUrl: json.serverUrl || currentConfig.serverUrl,
      siteId: json.siteId || currentConfig.siteId,
      token: json.token,
      user: json.user,
      apiKey: currentConfig.apiKey ?? '',
    };
    setConfig(newConfig);
    return newConfig;
  } catch {
    return null;
  }
}

/** Call backend via Next.js proxy. path must start with /v1/ or /api/ */
export async function apiRequest<T = unknown>(
  config: Config,
  path: string,
  options: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown } = {}
): Promise<T> {
  const { method = 'GET', body } = options;
  let currentConfig = config;

  const doRequest = async (cfg: Config): Promise<Response> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);
    try {
      const proxyBody: Record<string, unknown> = {
        serverUrl: cfg.serverUrl,
        siteId: cfg.siteId,
        path,
        method,
        body,
      };
      if (cfg.token) proxyBody.token = cfg.token;
      if (cfg.apiKey) proxyBody.apiKey = cfg.apiKey;

      const res = await fetch('/api/proxy', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(proxyBody),
      });
      return res;
    } finally {
      clearTimeout(timeout);
    }
  };

  let res = await doRequest(currentConfig);
  let json: { data?: unknown; error?: string } = await res.json();

  if (res.status === 401) {
    if (currentConfig.apiKey && !currentConfig.token) {
      throw new Error((json as { error?: string }).error ?? 'Unauthorized');
    }
    const newConfig = await tryRefresh(currentConfig);
    if (newConfig) {
      currentConfig = newConfig;
      res = await doRequest(currentConfig);
      json = await res.json();
    } else {
      if (typeof window !== 'undefined') {
        clearConfig();
        window.location.href = '/login';
      }
      throw new Error('Session expired. Please log in again.');
    }
  }

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      clearConfig();
      window.location.href = '/login';
    }
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
  const payload = (json as { data?: unknown }).data;
  if (payload && typeof payload === 'object' && 'ok' in payload && !(payload as { ok: boolean }).ok) {
    throw new Error((payload as { error?: string }).error ?? 'Request failed');
  }
  return payload as T;
}

export async function apiGet<T = unknown>(config: Config, path: string): Promise<T> {
  return apiRequest<T>(config, path, { method: 'GET' });
}

export async function apiPost<T = unknown>(config: Config, path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(config, path, { method: 'POST', body });
}

export async function apiPut<T = unknown>(config: Config, path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(config, path, { method: 'PUT', body });
}

export async function apiPatch<T = unknown>(config: Config, path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(config, path, { method: 'PATCH', body });
}

export async function apiDelete<T = unknown>(config: Config, path: string): Promise<T> {
  return apiRequest<T>(config, path, { method: 'DELETE' });
}
