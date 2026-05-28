import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-rule-engine/json';
import { enrichIntelligenceEventDetail } from '@/lib/school-rule-engine/enrichEventDetail';
import { getEvent, listAcknowledgements } from '@/lib/school-rule-engine/store';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = getEvent(Number(id));
  if (!event) return err('Not found', 404);
  return json({
    event,
    acknowledgements: listAcknowledgements(event.id),
    context: enrichIntelligenceEventDetail(event),
  });
}
