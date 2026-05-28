import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json } from '@/lib/school-gpt-copilot/json';
import { listRecommendations } from '@/lib/school-gpt-copilot/store';
import { dbQuery, isDbEnabled } from '@/lib/school-db/pool';

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const siteIdRaw = req.nextUrl.searchParams.get('siteId');
  const siteId = siteIdRaw ? Number(siteIdRaw) : undefined;
  if (!isDbEnabled()) {
    return json({
      organizationId,
      date,
      siteId,
      recommendations: listRecommendations(organizationId, date, siteId),
      source: 'memory' as const,
    });
  }
  const r = await dbQuery<{
    id: number;
    organization_id: number;
    site_id: number | null;
    summary_date: string;
    priority: 'High' | 'Medium' | 'Low';
    module_key: string;
    title: string;
    rationale: string;
    suggested_action: string;
    expected_impact: string | null;
    citations: string[] | null;
    created_at: string;
  }>(
    `SELECT id, organization_id, site_id, summary_date, priority, module_key, title, rationale,
            suggested_action, expected_impact, citations, created_at
     FROM school_gpt_recommendations
     WHERE organization_id = $1
       AND summary_date = $2
       AND COALESCE(site_id, 0) = COALESCE($3, 0)
     ORDER BY created_at DESC`,
    [organizationId, date, siteId ?? null]
  );
  const recommendations = (r?.rows ?? []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    siteId: row.site_id ?? undefined,
    summaryDate: row.summary_date,
    priority: row.priority,
    moduleKey: row.module_key,
    title: row.title,
    rationale: row.rationale,
    suggestedAction: row.suggested_action,
    expectedImpact: row.expected_impact ?? undefined,
    citations: row.citations ?? [],
    createdAt: row.created_at,
  }));
  return json({ organizationId, date, siteId, recommendations, source: 'postgres' as const });
}
