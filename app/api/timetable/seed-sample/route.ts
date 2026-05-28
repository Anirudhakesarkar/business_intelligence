import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import { DbDisabledError, seedReadableTimetableSample } from '@/lib/school-foundation/repos';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';

export async function POST(req: NextRequest) {
  await ensureFoundationHydrated();
  const body = await req.json().catch(() => ({}));
  const organizationId = Number(body.organizationId ?? 1);
  const replaceExisting = body.replaceExisting !== false;
  try {
    const result = await seedReadableTimetableSample(organizationId, { replaceExisting });
    return json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message, 400);
  }
}
