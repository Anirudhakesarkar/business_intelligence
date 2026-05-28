import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import { deleteSection, getSectionById, patchSection, DbDisabledError } from '@/lib/school-foundation/repos';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    return json(await getSectionById(Number(id)));
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message, 404);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  try {
    return json(
      await patchSection(Number(id), {
        name: body.name,
        expectedStudentCount: body.expectedStudentCount ?? body.expected_student_count,
        isActive: body.isActive,
      }),
    );
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return err('Invalid id', 400);
  try {
    await deleteSection(n);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    const msg = (e as Error).message;
    if (/not found/i.test(msg)) return err(msg, 404);
    return err(msg, 400);
  }
}
