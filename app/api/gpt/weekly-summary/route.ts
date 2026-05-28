import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-gpt-copilot/json';
import { getOrCreateWeeklySummary } from '@/lib/school-gpt-copilot/store';

export async function GET(req: NextRequest) {
  const weekStart = req.nextUrl.searchParams.get('weekStart') ?? new Date().toISOString().slice(0, 10);
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const siteIdRaw = req.nextUrl.searchParams.get('siteId');
  const siteId = siteIdRaw ? Number(siteIdRaw) : undefined;
  const result = getOrCreateWeeklySummary(organizationId, weekStart, siteId);
  if (!result.ok) return err(result.error, 422);
  return json({ organizationId, weekStart, siteId, summary: result.summary, daysIncluded: result.daysIncluded });
}
