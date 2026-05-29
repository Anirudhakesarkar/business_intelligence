import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-rule-engine/json';
import { acknowledgeEvent, listAcknowledgements } from '@/lib/school-rule-engine/store';
import { ensureEventHydrated } from '@/lib/school-db/load-events';
import { persistEventLifecycle } from '@/lib/school-db/persist-event-lifecycle';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const eventId = Number(id);
    const hydrated = await ensureEventHydrated(eventId);
    if (hydrated.organizationId == null) return err('Event not found', 404);
    const body = await req.json().catch(() => ({}));
    const event = acknowledgeEvent(eventId, body.userId, body.note);
    const ack = listAcknowledgements(event.id).at(-1);
    await persistEventLifecycle(event, ack);
    return json(event);
  } catch (e) {
    return err((e as Error).message);
  }
}
