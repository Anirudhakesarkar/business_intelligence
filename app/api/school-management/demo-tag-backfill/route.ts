import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import { tagCurrentFoundationAsDemo, countDemoTaggedForOrg } from '@/lib/school-foundation/demo-tags';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';

/** Tag all current org foundation rows as demo (for DBs seeded before demo tags existed). */
export async function POST(req: NextRequest) {
  await ensureFoundationHydrated();
  const body = await req.json().catch(() => ({}));
  const organizationId = Number((body as { organizationId?: number }).organizationId ?? 1);
  if (!Number.isFinite(organizationId) || organizationId < 1) {
    return err('Invalid organizationId', 400);
  }
  try {
    const before = await countDemoTaggedForOrg(organizationId);
    await tagCurrentFoundationAsDemo(organizationId);
    const after = await countDemoTaggedForOrg(organizationId);
    return json({
      ok: true,
      organizationId,
      before,
      after,
      newlyTagged: Math.max(0, after.total - before.total),
    });
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
