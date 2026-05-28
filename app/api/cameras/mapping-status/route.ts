import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json } from '@/lib/school-foundation/json';
import { getMappingStatus } from '@/lib/school-foundation/store';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';

export async function GET(req: NextRequest) {
  await ensureFoundationHydrated();
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  return json(getMappingStatus(organizationId));
}
