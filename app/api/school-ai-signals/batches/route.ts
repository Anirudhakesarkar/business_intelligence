import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-ai-signals/json';
import { closeBatch, listBatches, openBatch } from '@/lib/school-ai-signals/store';

export async function GET(req: NextRequest) {
  const cameraId = req.nextUrl.searchParams.get('cameraId');
  const workerId = req.nextUrl.searchParams.get('workerId');
  const openOnly = req.nextUrl.searchParams.get('openOnly');
  const limit = req.nextUrl.searchParams.get('limit');
  return json({
    batches: listBatches({
      cameraId: cameraId ? Number(cameraId) : undefined,
      workerId: workerId ? Number(workerId) : undefined,
      openOnly: openOnly === '1' || openOnly === 'true',
      limit: limit ? Number(limit) : undefined,
    }),
  });
}

/** Spec alias: POST /api/ai-signal-batches */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = (body.action as string) ?? 'open';
  try {
    if (action === 'close') {
      const batchId = Number(body.batchId);
      if (!batchId) return err('batchId required');
      return json({ batch: closeBatch(batchId, body.frameCount) });
    }
    const batchKey = (body.batchKey as string) ?? `batch-${Date.now()}`;
    const cameraId = Number(body.cameraId);
    if (!cameraId) return err('cameraId required');
    return json(
      {
        batch: openBatch({
          batchKey,
          cameraId,
          workerId: body.workerId,
          modelVersion: body.modelVersion,
        }),
      },
      201
    );
  } catch (e) {
    return err((e as Error).message);
  }
}
