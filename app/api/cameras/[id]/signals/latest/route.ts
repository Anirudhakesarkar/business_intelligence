import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-ai-signals/json';
import { getLatestSignals } from '@/lib/school-ai-signals/store';

/** Alias: GET /api/cameras/:id/signals/latest */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return json(getLatestSignals(Number(id)));
  } catch (e) {
    return err((e as Error).message, 404);
  }
}
