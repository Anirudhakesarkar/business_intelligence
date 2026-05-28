import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json } from '@/lib/school-daily-summaries/json';
import { aggregateDay } from '@/lib/school-daily-summaries/store';

export async function POST(req: NextRequest) {
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  return json({ ok: true, ...aggregateDay(organizationId, date) });
}
