import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import {
  commitCameraImport,
  validateCameraImport,
  type ImportCameraRow,
  DbDisabledError,
} from '@/lib/school-foundation/repos';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const organizationId = Number(body.organizationId ?? 1);
    const rows = (body.rows ?? []) as ImportCameraRow[];
    if (!rows.length) return err('rows required');
    const commit = Boolean(body.commit);
    if (commit) {
      return json(await commitCameraImport(organizationId, rows));
    }
    return json(await validateCameraImport(organizationId, rows));
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message);
  }
}
