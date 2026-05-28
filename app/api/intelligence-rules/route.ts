import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-rule-engine/json';
import { createRule, getLastEventStartedAtForRule, listRules } from '@/lib/school-rule-engine/store';

export async function GET(req: NextRequest) {
  const orgId = Number(req.nextUrl.searchParams.get('organizationId') ?? '1');
  const rules = listRules(orgId);
  return json(rules.map((r) => ({ ...r, lastFiredAt: getLastEventStartedAtForRule(r.id) ?? null })));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return json(createRule(body), 201);
  } catch (e) {
    return err((e as Error).message);
  }
}
