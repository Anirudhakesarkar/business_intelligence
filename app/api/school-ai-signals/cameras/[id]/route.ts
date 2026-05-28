import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-ai-signals/json';
import { getCameraAiDetail, getCameraFreshness, getLatestSignals, getSignalTimeline } from '@/lib/school-ai-signals/store';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cameraId = Number(id);
    const view = req.nextUrl.searchParams.get('view');
    if (view === 'freshness') return json(getCameraFreshness(cameraId));
    if (view === 'latest') return json(getLatestSignals(cameraId));
    if (view === 'timeline') {
      const from = req.nextUrl.searchParams.get('from') ?? new Date(Date.now() - 86400000).toISOString();
      const to = req.nextUrl.searchParams.get('to') ?? new Date().toISOString();
      return json({ timeline: getSignalTimeline(cameraId, from, to) });
    }
    return json(getCameraAiDetail(cameraId));
  } catch (e) {
    return err((e as Error).message, 404);
  }
}
