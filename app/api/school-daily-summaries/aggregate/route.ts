import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-daily-summaries/json';
import { aggregateDayPersisted } from '@/lib/school-daily-summaries/store';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';

export async function POST(req: NextRequest) {
  try {
    await ensureFoundationHydrated();
    const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
    const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
    if (!Number.isFinite(organizationId)) return err('Invalid organizationId', 400);
    const result = await aggregateDayPersisted(organizationId, date);
    return json({ ok: true, ...result });
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
