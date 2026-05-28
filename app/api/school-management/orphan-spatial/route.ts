import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import {
  countOrphanSpatialRows,
  hydrateFoundationFromPg,
  removeOrphanSpatialRows,
} from '@/lib/school-foundation/repos';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';

const CONFIRM_TOKEN = 'REMOVE_ORPHAN_SPATIAL';

export async function GET() {
  await ensureFoundationHydrated();
  const counts = await countOrphanSpatialRows();
  return json({ dryRun: true, counts });
}

export async function POST(req: NextRequest) {
  await ensureFoundationHydrated();
  try {
    const body = (await req.json()) as { dryRun?: boolean; confirm?: string };
    if (body.dryRun !== false) {
      const counts = await countOrphanSpatialRows();
      return json({ dryRun: true, counts });
    }
    if (body.confirm !== CONFIRM_TOKEN) {
      return err(`Confirmation required. Send confirm: "${CONFIRM_TOKEN}" with dryRun: false.`, 400);
    }
    const result = await removeOrphanSpatialRows({ dryRun: false });
    await hydrateFoundationFromPg().catch(() => undefined);
    return json(result);
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
