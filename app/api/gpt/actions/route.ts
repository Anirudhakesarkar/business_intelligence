import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-gpt-copilot/json';
import { createAction, createActionFromRecommendation, listActions } from '@/lib/school-gpt-copilot/store';
import { dbQuery, isDbEnabled } from '@/lib/school-db/pool';

async function listActionsFromPg(organizationId: number) {
  const r = await dbQuery<{
    id: number;
    organization_id: number;
    recommendation_id: number | null;
    summary_date: string;
    title: string;
    assignee: string | null;
    status: 'open' | 'completed' | 'cancelled';
    due_date: string | null;
    completed_at: string | null;
    created_at: string;
  }>(
    `SELECT id, organization_id, recommendation_id, summary_date, title, assignee, status, due_date, completed_at, created_at
     FROM school_gpt_action_tasks
     WHERE organization_id = $1
     ORDER BY created_at DESC`,
    [organizationId]
  );
  return (r?.rows ?? []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    recommendationId: row.recommendation_id ?? undefined,
    summaryDate: row.summary_date,
    title: row.title,
    assignee: row.assignee ?? undefined,
    status: row.status,
    dueDate: row.due_date ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
  }));
}

export async function GET(req: NextRequest) {
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  if (isDbEnabled()) {
    const actions = await listActionsFromPg(organizationId);
    return json({ organizationId, actions, source: 'postgres' as const });
  }
  return json({ organizationId, actions: listActions(organizationId), source: 'memory' as const });
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
