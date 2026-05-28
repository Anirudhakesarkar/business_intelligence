import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import { deleteClass, patchClass, DbDisabledError } from '@/lib/school-foundation/repos';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return err('Invalid id', 400);
  try {
    const body = await req.json();
    const row = await patchClass(n, {
      name: body.name,
      sortOrder: body.sortOrder != null ? Number(body.sortOrder) : undefined,
      isActive: body.isActive,
    });
    return json(row);
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    const msg = (e as Error).message;
    if (/not found/i.test(msg)) return err(msg, 404);
    return err(msg, 400);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return err('Invalid id', 400);
  try {
    await deleteClass(n);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    const msg = (e as Error).message;
    if (/not found/i.test(msg)) return err(msg, 404);
    return err(msg, 400);
  }
}
