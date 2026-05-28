import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import { deactivateTimetableEntry, patchTimetableEntry, DbDisabledError } from '@/lib/school-foundation/repos';

function patchFromBody(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  for (const key of [
    'sectionId',
    'subjectId',
    'roomId',
    'teacherId',
    'periodType',
    'dayOfWeek',
    'startTime',
    'endTime',
  ] as const) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  return patch;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    return json(await patchTimetableEntry(Number(params.id), patchFromBody(body)));
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    const msg = (e as Error).message;
    if (/not found/i.test(msg)) return err(msg, 404);
    return err(msg);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    return json(await deactivateTimetableEntry(Number(params.id)));
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message);
  }
}
