import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-score-engine/json';
import { calculateScoresForDay } from '@/lib/school-score-engine/store';

export async function POST(req: NextRequest) {
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const siteIdRaw = req.nextUrl.searchParams.get('siteId');
  const siteId = siteIdRaw ? Number(siteIdRaw) : undefined;
  if (!Number.isFinite(organizationId)) return err('Invalid organizationId');
  const result = calculateScoresForDay(organizationId, date, siteId);
  return json({ ok: true, ...result });
}
