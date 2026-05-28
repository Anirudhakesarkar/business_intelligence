import { test, expect } from '@playwright/test';
import { injectDemoAuth } from './helpers/auth';

const PHASE2_ROUTES = [
  { path: '/dashboard/school-management/ai-health', heading: 'Cameras & AI Health' },
  { path: '/dashboard/school-management/signals', heading: 'Signal Timeline' },
  { path: '/dashboard/school-management/workers', heading: 'AI Workers' },
] as const;

test.describe('School AI Signals — Phase 2 UI', () => {
  test.beforeEach(async ({ page }) => {
    await injectDemoAuth(page);
  });

  for (const route of PHASE2_ROUTES) {
    test(`${route.path} loads`, async ({ page }) => {
      const res = await page.goto(route.path);
      expect(res?.status()).toBeLessThan(400);
      await expect(page.getByRole('heading', { name: new RegExp(route.heading, 'i') }).first()).toBeVisible();
    });
  }

  test('ai-health shows KPI strip after seed', async ({ page }) => {
    await page.goto('/dashboard/school-management/ai-health');
    await page.getByRole('button', { name: /seed demo signals/i }).click();
    await expect(page.getByText(/active cameras/i)).toBeVisible({ timeout: 20_000 });
  });

  test('signals page shows evidence disclaimer', async ({ page }) => {
    await page.goto('/dashboard/school-management/signals');
    await expect(page.getByText(/raw ai evidence only/i)).toBeVisible();
  });

  test('health API returns kpis and grid', async ({ request }) => {
    const res = await request.get('/api/school-ai-signals/health?organizationId=1');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.kpis).toBeTruthy();
    expect(Array.isArray(body.grid)).toBeTruthy();
  });
});
