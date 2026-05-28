import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import { getSetupHealthWithPgMetrics } from '@/lib/school-foundation/setup-health-pg';
import { getSetupHealth } from '@/lib/school-foundation/store';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';
import { isStrictDbMode } from '@/lib/school-db/strict-mode';

export async function GET(req: NextRequest) {
  try {
    await ensureFoundationHydrated();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Foundation database hydrate failed';
    console.error('[setup-health] ensureFoundationHydrated failed:', e);
    const status = isStrictDbMode() ? 503 : 500;
    return err(message, status);
  }
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const health = isStrictDbMode()
    ? await getSetupHealthWithPgMetrics(organizationId)
    : getSetupHealth(organizationId);
  return json(health);
}
