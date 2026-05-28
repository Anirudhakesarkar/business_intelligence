import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-daily-summaries/json';
import { ensureDailySummariesForDate, getDailyOverview } from '@/lib/school-daily-summaries/store';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const siteIdRaw = req.nextUrl.searchParams.get('siteId');
  const siteId = siteIdRaw ? Number(siteIdRaw) : undefined;
  if (!Number.isFinite(organizationId)) return err('Invalid organizationId');
  await ensureFoundationHydrated();
  await ensureDailySummariesForDate(organizationId, date, siteId);
  return json(getDailyOverview(organizationId, date, siteId));
}
