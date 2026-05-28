import type { Page } from '@playwright/test';

/** Inject demo auth so dashboard layout does not redirect to /login. */
export async function injectDemoAuth(page: Page) {
  await page.addInitScript(() => {
    const user = {
      id: '1',
      email: 'admin@demo.school',
      display_name: 'Demo Admin',
      role: 'org_admin',
      site_ids: ['1'],
    };
    localStorage.setItem('vms_serverUrl', window.location.origin);
    localStorage.setItem('vms_siteId', '1');
    localStorage.setItem('vms_apiKey', 'demo-key');
    sessionStorage.setItem('vms_token', 'demo-e2e-token');
    sessionStorage.setItem('vms_user', JSON.stringify(user));
  });
}
