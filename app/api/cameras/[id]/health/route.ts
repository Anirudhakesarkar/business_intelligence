import { NextRequest } from 'next/server';
import { json } from '@/lib/school-ai-signals/json';
import { getCameraHealth } from '@/lib/school-ai-signals/store';

export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return json(getCameraHealth(Number(id)));
}
