import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import { createSubject, listSubjects, DbDisabledError } from '@/lib/school-foundation/repos';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';

export async function GET(req: NextRequest) {
  await ensureFoundationHydrated();
  try {
    const organizationId = req.nextUrl.searchParams.get('organizationId');
    const rows = await listSubjects(organizationId ?? undefined);
    return json(rows);
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const row = await createSubject(body);
    return json(row, 201);
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message);
  }
}
