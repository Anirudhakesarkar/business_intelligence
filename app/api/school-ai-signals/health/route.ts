import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json } from '@/lib/school-ai-signals/json';
import { getCameraHealthGrid, getCameraHealthKpis } from '@/lib/school-ai-signals/store';

export async function GET(req: NextRequest) {
  const orgId = Number(req.nextUrl.searchParams.get('organizationId') ?? '1');
  return json({ kpis: getCameraHealthKpis(orgId), grid: getCameraHealthGrid(orgId) });
}
