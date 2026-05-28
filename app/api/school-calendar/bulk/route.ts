import '@/lib/school-persistence/init';
import { json, err } from '@/lib/school-foundation/json';
import { commitCalendarBulk, DbDisabledError } from '@/lib/school-foundation/repos';
import type { CalendarDay } from '@/lib/school-foundation/types';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';

export async function POST(req: Request) {
  try {
    await ensureFoundationHydrated();
    const { days } = (await req.json()) as { days: Array<Omit<CalendarDay, 'id'>> };
    if (!Array.isArray(days) || !days.length) return err('days array required');
    return json(await commitCalendarBulk(days));
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message, 500);
  }
}
