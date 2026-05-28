import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';
import { DbDisabledError } from '@/lib/school-foundation/repos';
import {
  parseMasterDataCSV,
  commitMasterDataImport,
  importMasterDataBulk,
} from '@/lib/school-foundation/repos/master-data-import';

function resolveOrganizationId(req: NextRequest, formData: FormData): number {
  const fromForm = formData.get('organizationId');
  const fromQuery = req.nextUrl.searchParams.get('organizationId');
  const raw = fromForm ?? fromQuery ?? '1';
  const organizationId = Number(raw);
  if (!Number.isFinite(organizationId) || organizationId < 1) {
    throw new Error('Invalid organizationId');
  }
  return organizationId;
}

export async function POST(req: NextRequest) {
  try {
    await ensureFoundationHydrated();

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const dryRun = formData.get('dryRun') === 'true' || req.nextUrl.searchParams.get('dryRun') === '1';
    if (!file) return err('No file uploaded. Send a multipart/form-data POST with field name "file".');

    const organizationId = resolveOrganizationId(req, formData);
    const text = await file.text();
    const rows = parseMasterDataCSV(text);
    if (rows.length === 0) return err('CSV has no data rows. Ensure it has a header row and at least one data row.');

    const out = dryRun
      ? await importMasterDataBulk(organizationId, rows, { dryRun: true })
      : await commitMasterDataImport(organizationId, rows);

    return json({ ok: true, ...out });
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message, 500);
  }
}
