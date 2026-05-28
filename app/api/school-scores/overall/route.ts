import '@/lib/school-persistence/init';
import { ensureSchoolDbHydrated, hydrateGptForDate } from '@/lib/school-db/hydrate';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-score-engine/json';
import { getOverallScore } from '@/lib/school-score-engine/store';

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const siteIdRaw = req.nextUrl.searchParams.get('siteId');
  const siteId = siteIdRaw ? Number(siteIdRaw) : undefined;
  if (!Number.isFinite(organizationId)) return err('Invalid organizationId');
  await ensureSchoolDbHydrated(organizationId, date);
  const row = getOverallScore(organizationId, date, siteId);
  if (!row) return json({ organizationId, date, siteId, overallScore: null, moduleScores: [], message: 'No scores for date. Run POST /api/school-scores/calculate or seed.' });
  return json(row);
}
