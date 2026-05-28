import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-ai-signals/json';
import { recordHeartbeat } from '@/lib/school-ai-signals/store';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const apiKey = req.headers.get('x-worker-api-key') ?? body.apiKey;
  if (process.env.WORKER_API_KEY && apiKey !== process.env.WORKER_API_KEY) return err('Unauthorized worker', 401);
  try { return json({ heartbeat: recordHeartbeat(Number(id), body.metrics ?? {}) }); }
  catch (e) { return err((e as Error).message, 404); }
}
