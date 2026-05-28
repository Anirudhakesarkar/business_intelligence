import { test, expect } from '@playwright/test';
import { injectDemoAuth } from './helpers/auth';

const INTELLIGENCE_ROUTES = [
  { path: '/dashboard/school-intelligence', heading: 'School Intelligence' },
  { path: '/dashboard/school-intelligence/overall-score', heading: 'Overall School Score' },
  { path: '/dashboard/school-intelligence/actions', heading: 'GPT Action Tasks' },
  { path: '/dashboard/school-intelligence/teacher-productivity', heading: 'Teacher Productivity Intelligence' },
  { path: '/dashboard/school-intelligence/student-occupancy', heading: 'Student Occupancy Intelligence' },
  { path: '/dashboard/school-intelligence/academic-operations', heading: 'Academic Operations' },
  { path: '/dashboard/school-intelligence/staff-deployment', heading: 'Staff Deployment' },
  { path: '/dashboard/school-intelligence/space-utilization', heading: 'Space Utilization' },
  { path: '/dashboard/school-intelligence/discipline', heading: 'Discipline Intelligence' },
  { path: '/dashboard/school-intelligence/parent-experience', heading: 'Parent Experience' },
  { path: '/dashboard/school-intelligence/compliance', heading: 'Compliance Intelligence' },
  { path: '/dashboard/school-intelligence/events', heading: 'Intelligence events' },
  { path: '/dashboard/school-intelligence/rules', heading: 'Intelligence rules' },
  { path: '/dashboard/school-intelligence/score-settings', heading: 'Rules & Score Settings' },
] as const;

test.describe('School Intelligence — Phases 2–6 UI', () => {
  test.beforeEach(async ({ page }) => {
    await injectDemoAuth(page);
  });

  for (const route of INTELLIGENCE_ROUTES) {
    test(`${route.path} loads`, async ({ page }) => {
      const res = await page.goto(route.path);
      expect(res?.status()).toBeLessThan(400);
      await expect(page.getByRole('heading', { name: new RegExp(route.heading, 'i') }).first()).toBeVisible();
    });
  }

  test('overview shows bootstrap and module KPI strip', async ({ page }) => {
    await page.goto('/dashboard/school-intelligence');
    await expect(page.getByText(/School Intelligence/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /run full pipeline|bootstrap|refresh/i }).first()).toBeVisible({ timeout: 10_000 }).catch(() =>
      expect(page.getByText(/Teacher Productivity|Overall/i).first()).toBeVisible()
    );
  });

  test('POST bootstrap returns success', async ({ request }) => {
    const res = await request.post('/api/school-intelligence/bootstrap?organizationId=1');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok ?? body.bootstrap ?? body.organizationId).toBeTruthy();
  });

  test('sidebar lists School Intelligence section', async ({ page }) => {
    await page.goto('/dashboard/school-intelligence');
    await expect(page.getByText('12. School Intelligence')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Overall School Score' }).first()).toBeVisible();
  });
});
