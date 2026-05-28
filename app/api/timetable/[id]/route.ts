import '@/lib/school-persistence/init';
import { json, err } from '@/lib/school-foundation/json';
import { deactivateTimetableEntry, DbDisabledError } from '@/lib/school-foundation/repos';

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    return json(await deactivateTimetableEntry(Number(params.id)));
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message);
  }
}
