import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json } from '@/lib/school-rule-engine/json';
import { evaluateRules } from '@/lib/school-rule-engine/store';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const orgId = Number(body.organizationId ?? 1);
  const result = evaluateRules(orgId, { from: body.from, to: body.to });
  return json({ ok: true, ...result });
}
