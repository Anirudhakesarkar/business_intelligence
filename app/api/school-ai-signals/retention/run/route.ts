import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json } from '@/lib/school-ai-signals/json';
import { runRetentionJob } from '@/lib/school-ai-signals/store';

export async function POST(req: NextRequest) {
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  return json({ ok: true, ...runRetentionJob(organizationId) });
}
