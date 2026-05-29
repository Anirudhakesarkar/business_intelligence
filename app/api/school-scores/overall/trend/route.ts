import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-score-engine/json';
import { getOverallTrend } from '@/lib/school-score-engine/store';

import { ensureSchoolDbHydrated } from '@/lib/school-db/hydrate';

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const siteIdRaw = req.nextUrl.searchParams.get('siteId');
  const siteId = siteIdRaw ? Number(siteIdRaw) : undefined;
  const days = Number(req.nextUrl.searchParams.get('days') ?? 7);
  if (!Number.isFinite(organizationId)) return err('Invalid organizationId');
  await ensureSchoolDbHydrated(organizationId, date);
  return json(getOverallTrend(organizationId, date, days, siteId));
}
