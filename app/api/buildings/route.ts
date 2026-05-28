import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import { createBuilding, listBuildings, DbDisabledError } from '@/lib/school-foundation/repos';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';

export async function GET(req: NextRequest) {
  await ensureFoundationHydrated();
  try {
    const siteId = req.nextUrl.searchParams.get('siteId');
    const rows = await listBuildings(siteId ? Number(siteId) : undefined);
    return json(rows);
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const row = await createBuilding({
      siteId: body.siteId,
      name: body.name,
      isActive: body.isActive ?? true,
    });
    return json(row, 201);
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message);
  }
}
