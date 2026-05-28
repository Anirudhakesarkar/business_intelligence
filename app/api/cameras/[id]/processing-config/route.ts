import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-ai-signals/json';
import { getOrCreateProcessingConfig, patchProcessingConfig } from '@/lib/school-ai-signals/store';

export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try { return json(getOrCreateProcessingConfig(Number(id))); }
  catch (e) { return err((e as Error).message, 404); }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    return json(patchProcessingConfig(Number(id), await req.json()));
  } catch (e) { return err((e as Error).message); }
}
