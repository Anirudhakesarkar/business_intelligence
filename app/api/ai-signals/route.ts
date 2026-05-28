import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-ai-signals/json';
import { ingestSignal, ingestSignalsBulk, listSignals } from '@/lib/school-ai-signals/store';
import type { SignalType } from '@/lib/school-ai-signals/types';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const rows = listSignals({
    organizationId: Number(p.get('organizationId') ?? '1'),
    cameraId: p.get('cameraId') ? Number(p.get('cameraId')) : undefined,
    signalType: (p.get('signalType') as SignalType | null) ?? undefined,
    from: p.get('from') ?? undefined,
    to: p.get('to') ?? undefined,
    minConfidence: p.get('minConfidence') ? Number(p.get('minConfidence')) : undefined,
    limit: p.get('limit') ? Number(p.get('limit')) : undefined,
  });
  return json({ signals: rows, count: rows.length });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (Array.isArray(body)) {
      return json(ingestSignalsBulk(body));
    }
    return json(ingestSignal(body));
  } catch (e) {
    return err((e as Error).message);
  }
}
