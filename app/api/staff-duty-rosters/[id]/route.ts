import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import {
  deactivateDutyRoster,
  getDutyRoster,
  patchDutyRoster,
  DbDisabledError,
} from '@/lib/school-foundation/repos';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  await ensureFoundationHydrated();
  try {
    return json(await getDutyRoster(Number(params.id)));
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    const msg = (e as Error).message;
    return err(msg, msg === 'Not found' ? 404 : 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    return json(await patchDutyRoster(Number(params.id), body));
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    const msg = (e as Error).message;
    return err(msg, msg === 'Not found' ? 404 : 400);
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    return json(await deactivateDutyRoster(Number(params.id)));
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    const msg = (e as Error).message;
    return err(msg, msg === 'Not found' ? 404 : 400);
  }
}
