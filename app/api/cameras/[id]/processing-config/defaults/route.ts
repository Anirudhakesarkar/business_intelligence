import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-ai-signals/json';
import { applyPurposeDefaults } from '@/lib/school-ai-signals/store';

export async function POST(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    return json(applyPurposeDefaults(Number(id)));
  } catch (e) { return err((e as Error).message); }
}
