import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-ai-signals/json';
import { getCameraFreshness, getLatestSignals } from '@/lib/school-ai-signals/store';

/** GET /api/cameras/:id/freshness — last signal per enabled type + S6 stale flags */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cameraId = Number(id);
    const freshness = getCameraFreshness(cameraId);
    const latestByType = getLatestSignals(cameraId);
    return json({ ...freshness, latestByType });
  } catch (e) {
    return err((e as Error).message, 404);
  }
}
