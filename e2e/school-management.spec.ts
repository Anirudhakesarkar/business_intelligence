import { test, expect } from '@playwright/test';
import { injectDemoAuth } from './helpers/auth';

const PHASE1_ROUTES = [
  { path: '/dashboard/school-management', heading: 'School Management' },
  { path: '/dashboard/school-management/master-data', heading: 'Master Data' },
  { path: '/dashboard/school-management/cameras', heading: 'Cameras and Mapping' },
  { path: '/dashboard/school-management/timetable', heading: 'Timetable' },
  { path: '/dashboard/school-management/staff-duty', heading: 'Staff Duty Roster' },
  { path: '/dashboard/school-management/calendar', heading: 'School Calendar' },
  { path: '/dashboard/school-management/settings', heading: 'Settings' },
] as const;

test.describe('School Management — Phase 1 UI', () => {
  test.beforeEach(async ({ page }) => {
    await injectDemoAuth(page);
  });

  for (const route of PHASE1_ROUTES) {
    test(`${route.path} loads`, async ({ page }) => {
      const res = await page.goto(route.path);
      expect(res?.status()).toBeLessThan(400);
      await expect(page.getByRole('heading', { name: new RegExp(route.heading, 'i') }).first()).toBeVisible();
    });
  }

  test('overview shows setup progress and seed action', async ({ page }) => {
    await page.goto('/dashboard/school-management');
    await expect(page.getByRole('button', { name: /load demo seed/i })).toBeVisible();
    await expect(page.getByText(/cameras mapped/i)).toBeVisible();
  });

  test('sidebar lists School Management section', async ({ page }) => {
    await page.goto('/dashboard/school-management');
    await expect(page.getByText('11. School Management')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Overview' }).first()).toBeVisible();
    await expect(page.locator('a[href="/dashboard/school-management/settings"]')).toBeVisible();
  });

  test('load demo seed updates setup health', async ({ page }) => {
    await page.goto('/dashboard/school-management');
    await page.getByRole('button', { name: /load demo seed/i }).click();
    await expect(page.getByText(/ready for phase 2/i)).toBeVisible({ timeout: 20_000 });
  });

  test('settings shows compliance checklist and teaching zones', async ({ page }) => {
    await page.goto('/dashboard/school-management/settings');
    await expect(page.getByRole('heading', { name: /Settings/i }).first()).toBeVisible();
    await expect(page.getByText('Compliance checklist')).toBeVisible();
    await expect(page.getByText(/Teaching zones/i)).toBeVisible();
  });

  test('master data shows campus tree tab', async ({ page }) => {
    await page.goto('/dashboard/school-management/master-data');
    await expect(page.getByRole('button', { name: 'Campus Tree' })).toBeVisible();
    await page.getByRole('button', { name: 'Campus Tree' }).click();
    await expect(page.getByText(/site\(s\)/i)).toBeVisible();
  });

  test('cameras page shows mapping status', async ({ page }) => {
    await page.goto('/dashboard/school-management/cameras');
    await expect(page.getByText(/mapped/i)).toBeVisible();
  });

  test('calendar page has bulk holiday control', async ({ page }) => {
    await page.goto('/dashboard/school-management/calendar');
    await expect(page.getByRole('button', { name: /Bulk Mark/i })).toBeVisible();
  });

  test('overview next action link after seed', async ({ page }) => {
    await page.goto('/dashboard/school-management');
    await page.getByRole('button', { name: /load demo seed/i }).click();
    await expect(page.getByText(/ready for phase 2/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/calendar status/i)).toBeVisible();
  });

  test('sub-route shows shared setup progress bar', async ({ page }) => {
    await page.goto('/dashboard/school-management/timetable');
    await expect(page.getByText(/foundation setup/i)).toBeVisible();
  });

});
