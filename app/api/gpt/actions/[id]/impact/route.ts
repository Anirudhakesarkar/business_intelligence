import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-gpt-copilot/json';
import { getActionImpact } from '@/lib/school-gpt-copilot/store';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const result = getActionImpact(organizationId, Number(id));
  if (!result.ok) return err(result.error, 404);
  return json(result);
}
