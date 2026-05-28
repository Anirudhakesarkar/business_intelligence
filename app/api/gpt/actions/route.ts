import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-gpt-copilot/json';
import { createAction, createActionFromRecommendation, listActions } from '@/lib/school-gpt-copilot/store';

export async function GET(req: NextRequest) {
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  return json({ organizationId, actions: listActions(organizationId) });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const organizationId = Number(body.organizationId ?? 1);
  if (body.recommendationId) {
    const result = createActionFromRecommendation(organizationId, Number(body.recommendationId), body.assignee, body.dueDate);
    if (!result.ok) return err(result.error, 404);
    return json(result);
  }
  if (!body.title || !body.summaryDate) return err('title and summaryDate required');
  return json(createAction(organizationId, body.title, body.summaryDate, body.assignee, body.dueDate));
}
