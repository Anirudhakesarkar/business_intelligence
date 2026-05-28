import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-rule-engine/json';
import { acknowledgeEvent } from '@/lib/school-rule-engine/store';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    return json(acknowledgeEvent(Number(id), body.userId, body.note));
  } catch (e) {
    return err((e as Error).message);
  }
}
