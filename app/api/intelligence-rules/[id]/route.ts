import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-rule-engine/json';
import { deleteRule, getRule, listConditionsForRule, updateRule } from '@/lib/school-rule-engine/store';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rule = getRule(Number(id));
  if (!rule) return err('Not found', 404);
  return json({ rule, conditions: listConditionsForRule(rule.id) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    return json(updateRule(Number(id), body));
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    deleteRule(Number(id));
    return json({ ok: true });
  } catch (e) {
    return err((e as Error).message);
  }
}
