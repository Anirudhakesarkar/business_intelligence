import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json } from '@/lib/school-gpt-copilot/json';
import { seedSchoolGptPipeline } from '@/lib/school-gpt-copilot/seed';

export async function POST(req: NextRequest) {
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const date = req.nextUrl.searchParams.get('date') ?? undefined;
  return json({ ok: true, ...seedSchoolGptPipeline(organizationId, date) });
}
