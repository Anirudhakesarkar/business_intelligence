import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import { patchCamera, listCameras, DbDisabledError } from '@/lib/school-foundation/repos';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await ensureFoundationHydrated();
  try {
    const cam = (await listCameras()).find((c) => c.id === Number(id));
    if (!cam) return err('Camera not found', 404);
    const zones = (cam.metadata as { teachingZones?: unknown })?.teachingZones ?? {};
    return json(zones);
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message, 500);
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  try {
    const cam = (await listCameras()).find((c) => c.id === Number(id));
    if (!cam) return err('Camera not found', 404);
    const meta = { ...(cam.metadata ?? {}), teachingZones: body };
    return json(await patchCamera(Number(id), { metadata: meta }));
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message, 404);
  }
}
