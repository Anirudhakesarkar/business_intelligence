import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import { patchCamera, listCameras, deleteCamera, DbDisabledError } from '@/lib/school-foundation/repos';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  await ensureFoundationHydrated();
  try {
    const rows = await listCameras();
    const row = rows.find((c) => c.id === Number(params.id));
    if (!row) return err('Not found', 404);
    return json(row);
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message, 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    return json(await patchCamera(Number(params.id), body));
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message);
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    return json(await deleteCamera(Number(params.id)));
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    const msg = (e as Error).message;
    if (/not found/i.test(msg)) return err(msg, 404);
    return err(msg);
  }
}
