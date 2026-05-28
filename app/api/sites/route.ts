import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import { createSite, listSites, DbDisabledError } from '@/lib/school-foundation/repos/sites';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';

export async function GET(req: NextRequest) {
  await ensureFoundationHydrated();
  try {
    const orgParam = req.nextUrl.searchParams.get('organizationId');
    const rows = await listSites(orgParam ?? undefined);
    return json(rows);
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const row = await createSite({
      organizationId: body.organizationId,
      name: body.name,
      address: body.address,
      isActive: body.isActive ?? true,
    });
    return json(row, 201);
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message);
  }
}
