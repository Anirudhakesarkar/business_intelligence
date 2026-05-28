import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-gpt-copilot/json';
import { regenerateDailySummary } from '@/lib/school-gpt-copilot/store';

export async function POST(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const siteIdRaw = req.nextUrl.searchParams.get('siteId');
  const siteId = siteIdRaw ? Number(siteIdRaw) : undefined;
  const result = await regenerateDailySummary(organizationId, date, siteId);
  if (!result.ok) return err(result.error, result.code === 'missing_scores' ? 422 : 400);
  return json({ ok: true, summary: result.summary, citations: result.summary.citations });
}
