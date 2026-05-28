import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import {
  ACCEPTANCE_RESIDUE_CONFIRM_TOKEN,
  countAcceptanceResidueRows,
  hydrateFoundationFromPg,
  removeAcceptanceResidueRows,
} from '@/lib/school-foundation/repos';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';

export async function GET(req: NextRequest) {
  await ensureFoundationHydrated();
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const counts = await countAcceptanceResidueRows(organizationId);
  return json({ dryRun: true, counts });
}

export async function POST(req: NextRequest) {
  await ensureFoundationHydrated();
  try {
    const body = (await req.json()) as {
      organizationId?: number;
      dryRun?: boolean;
      confirm?: string;
    };
    const organizationId = body.organizationId ?? 1;
    if (body.dryRun !== false) {
      const counts = await countAcceptanceResidueRows(organizationId);
      return json({ dryRun: true, counts });
    }
    if (body.confirm !== ACCEPTANCE_RESIDUE_CONFIRM_TOKEN) {
      return err(
        `Confirmation required. Send confirm: "${ACCEPTANCE_RESIDUE_CONFIRM_TOKEN}" with dryRun: false.`,
        400,
      );
    }
    const result = await removeAcceptanceResidueRows({ organizationId, dryRun: false });
    await hydrateFoundationFromPg().catch(() => undefined);
    return json(result);
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
