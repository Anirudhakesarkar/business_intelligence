import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json } from '@/lib/school-ai-signals/json';
import { listDerivedSignals } from '@/lib/school-ai-signals/store';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const cameraId = Number(id);
  return json({ cameraId, derived: listDerivedSignals(cameraId) });
}
