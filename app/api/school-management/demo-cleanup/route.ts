import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import { countDemoTaggedForOrg, removeDemoTaggedForOrg } from '@/lib/school-foundation/demo-tags';
import { hydrateFoundationFromPg } from '@/lib/school-foundation/repos';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';

const CONFIRM_TOKEN = 'REMOVE_DEMO_DATA';

export async function GET(req: NextRequest) {
  await ensureFoundationHydrated();
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  if (!Number.isFinite(organizationId) || organizationId < 1) {
    return err('Invalid organizationId', 400);
  }
  const counts = await countDemoTaggedForOrg(organizationId);
  return json({ organizationId, dryRun: true, counts });
}

export async function POST(req: NextRequest) {
  await ensureFoundationHydrated();
  try {
    const body = (await req.json()) as {
      organizationId?: number;
      dryRun?: boolean;
      confirm?: string;
    };
    const organizationId = Number(body.organizationId ?? 1);
    if (!Number.isFinite(organizationId) || organizationId < 1) {
      return err('Invalid organizationId', 400);
    }

    if (body.dryRun !== false) {
      const result = await removeDemoTaggedForOrg(organizationId, { dryRun: true });
      return json({ organizationId, ...result });
    }

    if (body.confirm !== CONFIRM_TOKEN) {
      return err(`Confirmation required. Send confirm: "${CONFIRM_TOKEN}" with dryRun: false.`, 400);
    }

    const result = await removeDemoTaggedForOrg(organizationId, { dryRun: false });
    await hydrateFoundationFromPg().catch(() => undefined);
    return json({ organizationId, ...result });
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
