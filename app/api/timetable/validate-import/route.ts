import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import {
  commitTimetableImport,
  validateTimetableImport,
  type TimetableImportRow,
  DbDisabledError,
} from '@/lib/school-foundation/repos';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';

export async function POST(req: NextRequest) {
  await ensureFoundationHydrated();
  const body = await req.json().catch(() => ({}));
  const organizationId = Number(body.organizationId ?? 1);
  const rows = (body.rows ?? []) as TimetableImportRow[];
  const commit = Boolean(body.commit);
  try {
    if (commit) {
      const validation = await validateTimetableImport(organizationId, rows);
      const result = await commitTimetableImport(organizationId, rows);
      return json({ ...validation, ...result });
    }
    return json(await validateTimetableImport(organizationId, rows));
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message, 400);
  }
}
