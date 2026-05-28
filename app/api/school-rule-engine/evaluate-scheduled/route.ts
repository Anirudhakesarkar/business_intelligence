import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json } from '@/lib/school-rule-engine/json';
import { evaluateRules, seedDefaultRules } from '@/lib/school-rule-engine/store';

/** Cron-friendly: evaluate rules for today (last 24h window). */
export async function POST(req: NextRequest) {
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  seedDefaultRules(organizationId);
  const evaluation = evaluateRules(organizationId, {
    from: `${date}T00:00:00.000Z`,
    to: `${date}T23:59:59.999Z`,
  });
  return json({ ok: true, organizationId, date, evaluation });
}
