import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-ai-signals/json';
import { ingestSignalsBulk } from '@/lib/school-ai-signals/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return json(ingestSignalsBulk(Array.isArray(body) ? body : body.signals ?? []));
  } catch (e) {
    return err((e as Error).message);
  }
}
