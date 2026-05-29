import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-daily-summaries/json';
import { ensureDailySummariesForDate, getModuleDailyTrend } from '@/lib/school-daily-summaries/store';
import type { DailySummaryModule } from '@/lib/school-daily-summaries/types';

const MODULES = new Set(['teacher','classroom','occupancy','process','staff','space','discipline','parent','compliance','school']);

export async function GET(req: NextRequest, ctx: { params: Promise<{ module: string }> }) {
  const { module } = await ctx.params;
  if (!MODULES.has(module)) return err('Unknown module', 404);
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const siteIdRaw = req.nextUrl.searchParams.get('siteId');
  const siteId = siteIdRaw ? Number(siteIdRaw) : undefined;
  const days = Number(req.nextUrl.searchParams.get('days') ?? 7);
  const metric = req.nextUrl.searchParams.get('metric') ?? undefined;
  await ensureDailySummariesForDate(organizationId, date, siteId);
  return json(getModuleDailyTrend(module as DailySummaryModule, organizationId, date, days, siteId, metric));
}
