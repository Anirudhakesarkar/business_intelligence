import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-ai-signals/json';
import { deleteDiagnosticMedia } from '@/lib/school-ai-signals/store';

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    deleteDiagnosticMedia(Number(id));
    return json({ ok: true });
  } catch (e) {
    return err((e as Error).message, 404);
  }
}
