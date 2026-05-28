import type { AuthUser, Config } from '@/lib/types';

const CONFIG_KEYS = {
  serverUrl: 'vms_serverUrl',
  siteId: 'vms_siteId',
  apiKey: 'vms_apiKey',
  /** Access token — sessionStorage only (tab-scoped; reduces XSS persistence vs localStorage). */
  token: 'vms_token',
  user: 'vms_user',
} as const;

export function getConfig(): Config | null {
  if (typeof window === 'undefined') return null;

  try {
    const serverUrl = localStorage.getItem(CONFIG_KEYS.serverUrl);
    const token = sessionStorage.getItem(CONFIG_KEYS.token);
    const userJson = sessionStorage.getItem(CONFIG_KEYS.user);

    if (serverUrl && token && userJson) {
      const user = JSON.parse(userJson) as AuthUser;
      const siteId = localStorage.getItem(CONFIG_KEYS.siteId) || user.site_ids[0] || '';
      const apiKey = localStorage.getItem(CONFIG_KEYS.apiKey) || '';
      return { serverUrl, siteId, apiKey, token, user };
    }

    const siteId = localStorage.getItem(CONFIG_KEYS.siteId);
    const apiKey = localStorage.getItem(CONFIG_KEYS.apiKey);
    if (!serverUrl || !siteId || !apiKey) return null;
    return { serverUrl, siteId, apiKey };
  } catch (error) {
    console.error('Failed to get config:', error);
    return null;
  }
}

export function setConfig(config: Config): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(CONFIG_KEYS.serverUrl, config.serverUrl);
    localStorage.setItem(CONFIG_KEYS.siteId, config.siteId);
    localStorage.setItem(CONFIG_KEYS.apiKey, config.apiKey);
    if (config.token) sessionStorage.setItem(CONFIG_KEYS.token, config.token);
    if (config.user) sessionStorage.setItem(CONFIG_KEYS.user, JSON.stringify(config.user));
  } catch (error) {
    console.error('Failed to set config:', error);
  }
}

export function clearConfig(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(CONFIG_KEYS.serverUrl);
    localStorage.removeItem(CONFIG_KEYS.siteId);
    localStorage.removeItem(CONFIG_KEYS.apiKey);
    sessionStorage.removeItem(CONFIG_KEYS.token);
    sessionStorage.removeItem(CONFIG_KEYS.user);
    // Remove legacy refresh token from older builds
    localStorage.removeItem('vms_refreshToken');
  } catch (error) {
    console.error('Failed to clear config:', error);
  }
}
