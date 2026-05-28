import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-gpt-copilot/json';
import { updateAction } from '@/lib/school-gpt-copilot/store';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const organizationId = Number(body.organizationId ?? 1);
  const result = updateAction(organizationId, Number(id), body);
  if (!result.ok) return err(result.error, 404);
  return json(result);
}
