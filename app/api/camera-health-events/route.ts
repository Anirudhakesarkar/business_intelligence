import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-ai-signals/json';
import { createHealthEvent } from '@/lib/school-ai-signals/store';

export async function POST(req: NextRequest) {
  try { return json(createHealthEvent(await req.json()), 201); }
  catch (e) { return err((e as Error).message); }
}
