import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import { createSite, listSites, DbDisabledError } from '@/lib/school-foundation/repos/sites';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';
import { isDbEnabled } from '@/lib/school-db/pool';
import { isStrictDbMode } from '@/lib/school-db/strict-mode';

export async function GET(req: NextRequest) {
  if (!isDbEnabled()) {
    return err('Postgres is not configured', 503);
  }
  try {
    await ensureFoundationHydrated();
    const orgParam = req.nextUrl.searchParams.get('organizationId');
    const rows = await listSites(orgParam ?? undefined);
    return json(rows);
  } catch (e) {
    if (e instanceof DbDisabledError) {
      return err(e.message, 503);
    }
    console.warn('[api/sites] postgres error:', (e as Error).message);
    if (isStrictDbMode()) {
      return err((e as Error).message, 503);
    }
    return json([]);
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
