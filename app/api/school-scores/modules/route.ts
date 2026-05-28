import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-score-engine/json';
import { listModuleScores } from '@/lib/school-score-engine/store';
import { visibleScoreModules } from '@/lib/school-score-engine/flags';
import { MODULE_LABELS } from '@/lib/school-score-engine/weights';

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const siteIdRaw = req.nextUrl.searchParams.get('siteId');
  const siteId = siteIdRaw ? Number(siteIdRaw) : undefined;
  if (!Number.isFinite(organizationId)) return err('Invalid organizationId');
  const rows = listModuleScores(organizationId, date, siteId);
  const visible = new Set(visibleScoreModules());
  return json({
    organizationId,
    date,
    siteId,
    modules: rows
      .filter((r) => visible.has(r.moduleKey))
      .map((r) => ({ ...r, label: MODULE_LABELS[r.moduleKey] })),
  });
}
