import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json } from '@/lib/school-ai-signals/json';
import { listDiagnosticMedia } from '@/lib/school-ai-signals/store';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const includeExpired = req.nextUrl.searchParams.get('includeExpired') === 'true';
  return json({ cameraId: Number(id), media: listDiagnosticMedia(Number(id), includeExpired) });
}
