import '@/lib/school-persistence/init';
import { json, err } from '@/lib/school-foundation/json';
import { createCalendarDay, DbDisabledError } from '@/lib/school-foundation/repos';

export async function POST(req: Request) {
  try {
    const { days } = (await req.json()) as { days: Array<Record<string, unknown>> };
    const created = [];
    for (const d of days) {
      created.push(await createCalendarDay(d as never));
    }
    return json({ count: created.length, days: created });
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message);
  }
}
