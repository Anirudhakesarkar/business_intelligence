import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-gpt-copilot/json';
import { askGpt } from '@/lib/school-gpt-copilot/store';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const question = (body.question as string)?.trim();
  if (!question) return err('question is required');
  const organizationId = Number(body.organizationId ?? 1);
  const date = (body.date as string) ?? new Date().toISOString().slice(0, 10);
  const siteId = body.siteId != null ? Number(body.siteId) : undefined;
  const conversationId = body.conversationId as string | undefined;
  const result = await askGpt(organizationId, date, question, conversationId, siteId);
  if (!result.ok) return err(result.error, 422);
  return json(result);
}
