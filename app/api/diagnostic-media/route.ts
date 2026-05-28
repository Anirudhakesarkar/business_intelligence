import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-ai-signals/json';
import { registerDiagnosticMedia } from '@/lib/school-ai-signals/store';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    const expiresAt = body.expiresAt ?? new Date(Date.now() + 14 * 86400000).toISOString();
    return json(registerDiagnosticMedia({
      cameraId: Number(body.cameraId),
      mediaType: body.mediaType ?? 'snapshot',
      storageUrl: body.storageUrl ?? 's3://demo/snapshot.jpg',
      capturedAt: body.capturedAt ?? new Date().toISOString(),
      expiresAt,
    }), 201);
  } catch (e) {
    return err((e as Error).message);
  }
}
