import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-ai-signals/json';
import { getSignalTimeline } from '@/lib/school-ai-signals/store';

const EXPORT_MAX = 5000;

/** Alias: GET /api/cameras/:id/signals/timeline */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const from = req.nextUrl.searchParams.get('from') ?? new Date(Date.now() - 86400000).toISOString();
    const to = req.nextUrl.searchParams.get('to') ?? new Date().toISOString();
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 2000), EXPORT_MAX);
    return json({ timeline: getSignalTimeline(Number(id), from, to, limit), limit });
  } catch (e) {
    return err((e as Error).message, 404);
  }
}
