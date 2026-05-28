import '@/lib/school-persistence/init';
import { ensureSchoolDbHydrated, hydrateGptForDate } from '@/lib/school-db/hydrate';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-gpt-copilot/json';
import { getOrCreateDailySummary } from '@/lib/school-gpt-copilot/store';

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const siteIdRaw = req.nextUrl.searchParams.get('siteId');
  const siteId = siteIdRaw ? Number(siteIdRaw) : undefined;
  await ensureSchoolDbHydrated(organizationId, date);
  await hydrateGptForDate(organizationId, date, siteId);
  const result = await getOrCreateDailySummary(organizationId, date, siteId);
  if (!result.ok) return json({ organizationId, date, siteId, error: result.error, code: result.code }, 422);
  const cached = 'cached' in result ? Boolean((result as { cached?: boolean }).cached) : true;
  return json({ organizationId, date, siteId, summary: result.summary, cached });
}
