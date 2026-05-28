import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json } from '@/lib/school-rule-engine/json';
import { evaluateRules } from '@/lib/school-rule-engine/store';

export async function POST(req: NextRequest) {
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  return json({ ok: true, ...evaluateRules(organizationId) });
}
