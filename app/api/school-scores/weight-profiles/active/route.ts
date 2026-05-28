import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json } from '@/lib/school-score-engine/json';
import { getActiveWeightProfile } from '@/lib/school-score-engine/store';

export async function GET(req: NextRequest) {
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  return json({ organizationId, date, profile: getActiveWeightProfile(organizationId, date) });
}
