import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json } from '@/lib/school-ai-signals/json';
import { runFreshnessHealthJob } from '@/lib/school-ai-signals/store';

/** POST — S6 freshness scan (cron / worker hook) */
export async function POST(req: NextRequest) {
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  return json({ ok: true, ...runFreshnessHealthJob(organizationId) });
}
