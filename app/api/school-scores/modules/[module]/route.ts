import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-score-engine/json';
import { getModuleScoreDetail } from '@/lib/school-score-engine/store';
import type { ScoreModuleKey } from '@/lib/school-score-engine/types';
import { MODULE_LABELS } from '@/lib/school-score-engine/weights';

const KEYS = new Set([
  'safety', 'security', 'teacher', 'occupancy', 'academic', 'staff', 'space', 'discipline', 'parent', 'compliance',
]);

import { ensureSchoolDbHydrated } from '@/lib/school-db/hydrate';

export async function GET(req: NextRequest, ctx: { params: Promise<{ module: string }> }) {
  const { module } = await ctx.params;
  if (!KEYS.has(module)) return err('Unknown module');
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const siteIdRaw = req.nextUrl.searchParams.get('siteId');
  const siteId = siteIdRaw ? Number(siteIdRaw) : undefined;
  await ensureSchoolDbHydrated(organizationId, date);
  const detail = getModuleScoreDetail(organizationId, date, module as ScoreModuleKey, siteId);
  return json({
    module,
    label: MODULE_LABELS[module as ScoreModuleKey],
    ...detail,
    drivers: detail.top_drivers,
  });
}
