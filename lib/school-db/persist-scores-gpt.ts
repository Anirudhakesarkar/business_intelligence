import { dbQuery, isDbEnabled } from './pool';
import type { DailyOverallScore, ModuleScore } from '../school-score-engine/types';
import type { GptSummaryRecord } from '../school-gpt-copilot/types';

export async function persistModuleScore(row: ModuleScore) {
  if (!isDbEnabled()) return;
  await dbQuery(
    `DELETE FROM school_daily_module_scores
     WHERE organization_id = $1 AND score_date = $2 AND module_key = $3
       AND COALESCE(site_id, 0) = COALESCE($4, 0)`,
    [row.organizationId, row.scoreDate, row.moduleKey, row.siteId ?? null]
  );
  await dbQuery(
    `INSERT INTO school_daily_module_scores
      (organization_id, site_id, score_date, module_key, score, drivers, weight_profile_id)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
    [
      row.organizationId,
      row.siteId ?? null,
      row.scoreDate,
      row.moduleKey,
      row.score,
      JSON.stringify(row.drivers),
      row.weightProfileId ?? null,
    ]
  );
}

export async function persistDailyScore(row: DailyOverallScore) {
  if (!isDbEnabled()) return;
  for (const m of row.moduleScores) {
    await persistModuleScore(m);
  }
  await dbQuery(
    `DELETE FROM school_daily_scores
     WHERE organization_id = $1 AND score_date = $2 AND COALESCE(site_id, 0) = COALESCE($3, 0)`,
    [row.organizationId, row.scoreDate, row.siteId ?? null]
  );
  await dbQuery(
    `INSERT INTO school_daily_scores
      (organization_id, site_id, score_date, overall_score, weight_profile_id, module_scores_snapshot)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      row.organizationId,
      row.siteId ?? null,
      row.scoreDate,
      row.overallScore,
      row.weightProfileId,
      JSON.stringify(row.moduleScores),
    ]
  );
}

export async function loadDailyScore(organizationId: number, date: string, siteId?: number) {
  if (!isDbEnabled()) return null;
  const r = await dbQuery<{
    overall_score: string;
    weight_profile_id: number;
    module_scores_snapshot: unknown;
  }>(
    `SELECT overall_score, weight_profile_id, module_scores_snapshot FROM school_daily_scores
     WHERE organization_id = $1 AND score_date = $2 AND COALESCE(site_id, 0) = COALESCE($3, 0)
     ORDER BY created_at DESC LIMIT 1`,
    [organizationId, date, siteId ?? null]
  );
  const row = r?.rows[0];
  if (!row) return null;
  return {
    overallScore: Number(row.overall_score),
    weightProfileId: row.weight_profile_id,
    moduleScores: row.module_scores_snapshot,
  };
}

export async function persistGptSummary(row: GptSummaryRecord) {
  if (!isDbEnabled()) return;
  await dbQuery(
    `DELETE FROM school_gpt_summaries
     WHERE organization_id = $1 AND summary_type = $2 AND summary_date = $3
       AND COALESCE(site_id, 0) = COALESCE($4, 0)`,
    [row.organizationId, row.summaryType, row.summaryDate, row.siteId ?? null]
  );
  await dbQuery(
    `INSERT INTO school_gpt_summaries
      (organization_id, site_id, summary_type, summary_date, week_start, content, citations, model)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
    [
      row.organizationId,
      row.siteId ?? null,
      row.summaryType,
      row.summaryDate,
      row.weekStart ?? null,
      row.content,
      JSON.stringify(row.citations),
      row.model,
    ]
  );
}

export async function loadGptSummary(
  organizationId: number,
  summaryType: 'daily' | 'weekly',
  summaryDate: string,
  siteId?: number
) {
  if (!isDbEnabled()) return null;
  const r = await dbQuery<{ content: string; citations: unknown; model: string; created_at: Date }>(
    `SELECT content, citations, model, created_at FROM school_gpt_summaries
     WHERE organization_id = $1 AND summary_type = $2 AND summary_date = $3
       AND COALESCE(site_id, 0) = COALESCE($4, 0)
     ORDER BY created_at DESC LIMIT 1`,
    [organizationId, summaryType, summaryDate, siteId ?? null]
  );
  const row = r?.rows[0];
  if (!row) return null;
  return {
    content: row.content,
    citations: row.citations as string[],
    model: row.model,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}
