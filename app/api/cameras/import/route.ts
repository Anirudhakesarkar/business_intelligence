import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import { commitCameraImport, type ImportCameraRow, DbDisabledError } from '@/lib/school-foundation/repos';

/** @deprecated Prefer POST /api/cameras/validate-import with commit=true (atomic). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const organizationId = Number(body.organizationId ?? 1);
    const rows = (body.rows ?? []) as ImportCameraRow[];
    if (!rows.length) return err('rows required');
    const result = await commitCameraImport(organizationId, rows);
    return json({
      created: result.created,
      errors: result.errors,
      skipped: result.skipped,
      committed: result.committed,
      atomicAborted: result.atomicAborted,
    });
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message);
  }
}
