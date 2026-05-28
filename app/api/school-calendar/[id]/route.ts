import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import {
  deleteCalendarDay,
  getCalendarDayById,
  patchCalendarDay,
  DbDisabledError,
} from '@/lib/school-foundation/repos';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: RouteParams) {
  await ensureFoundationHydrated();
  try {
    const { id } = await params;
    const row = await getCalendarDayById(Number(id));
    if (!row) return err('Calendar day not found', 404);
    return json(row);
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message, 500);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();
    return json(await patchCalendarDay(Number(id), body));
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    const msg = (e as Error).message;
    return err(msg, msg.includes('not found') ? 404 : 400);
  }
}

export async function DELETE(_: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    return json(await deleteCalendarDay(Number(id)));
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    const msg = (e as Error).message;
    return err(msg, msg.includes('not found') ? 404 : 400);
  }
}
