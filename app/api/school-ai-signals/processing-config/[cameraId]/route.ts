import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-ai-signals/json';
import { getProcessingConfig, upsertProcessingConfig } from '@/lib/school-ai-signals/store';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cameraId: string }> }) {
  const { cameraId } = await params;
  const cfg = getProcessingConfig(Number(cameraId));
  if (!cfg) return err('Not found', 404);
  return json(cfg);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ cameraId: string }> }) {
  try {
    const { cameraId } = await params;
    const body = await req.json();
    return json(upsertProcessingConfig(Number(cameraId), body));
  } catch (e) {
    return err((e as Error).message);
  }
}
