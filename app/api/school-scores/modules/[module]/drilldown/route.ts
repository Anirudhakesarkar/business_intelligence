import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-score-engine/json';
import { getScoreDrilldown } from '@/lib/school-score-engine/drilldown';
import type { ScoreModuleKey } from '@/lib/school-score-engine/types';

const MODULES = new Set<ScoreModuleKey>(['safety','security','teacher','occupancy','academic','staff','space','discipline','parent','compliance']);

export async function GET(req: NextRequest, ctx: { params: Promise<{ module: string }> }) {
  const { module } = await ctx.params;
  if (!MODULES.has(module as ScoreModuleKey)) return err('Unknown module', 404);
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const driverKey = req.nextUrl.searchParams.get('driverKey') ?? undefined;
  return json(getScoreDrilldown(organizationId, date, module as ScoreModuleKey, driverKey));
}
