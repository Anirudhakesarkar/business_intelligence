import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json } from '@/lib/school-rule-engine/json';
import { listEvents } from '@/lib/school-rule-engine/store';
import type { EventStatus, EventType } from '@/lib/school-rule-engine/types';
import { ensureRuleEngineHydrated } from '@/lib/school-db/load-events';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const organizationId = Number(p.get('organizationId') ?? '1');
  await ensureRuleEngineHydrated(organizationId);
  const zoneId = p.get('zoneId');
  const rows = listEvents(organizationId, {
    from: p.get('from') ?? undefined,
    to: p.get('to') ?? undefined,
    eventType: (p.get('eventType') as EventType | null) ?? undefined,
    status: (p.get('status') as EventStatus | null) ?? undefined,
    zoneId: zoneId ? Number(zoneId) : undefined,
  });
  return json({ events: rows, count: rows.length });
}
