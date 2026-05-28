import type { GptSummaryRecord } from '../school-gpt-copilot/types';
import { getCachedDailySummary } from '../school-gpt-copilot/store';
import { gptDb } from '../school-gpt-copilot/store';
import type { DailyOverallScore, ModuleScore, ScoreModuleKey } from '../school-score-engine/types';
import { getOverallScore, scoreDb } from '../school-score-engine/store';
import { DEFAULT_WEIGHTS } from '../school-score-engine/weights';
import { hydrateFoundationFromPg } from '../school-foundation/repos';
import { dbQuery, isDbEnabled } from './pool';
import { isStrictDbMode } from './strict-mode';
import { loadDailyScore, loadGptSummary } from './persist-scores-gpt';

let hydrateInflight: Promise<void> | null = null;
let foundationHydrateInflight: Promise<void> | null = null;

/**
 * Hydrate PG-backed foundation entities (sites, ...) into the in-memory cache
 * exactly once per process. As more entities migrate to PG-backed repos, add
 * their hydrate functions here.
 */
export function ensureFoundationHydrated() {
  if (!isDbEnabled()) return Promise.resolve();
  if (!foundationHydrateInflight) {
    foundationHydrateInflight = hydrateFoundationFromPg().catch((err) => {
      if (isStrictDbMode()) throw err;
    });
  }
  return foundationHydrateInflight;
}

/** Load latest scores + GPT from Postgres into in-memory stores (one flight per process). */
export function ensureSchoolDbHydrated(organizationId = 1, date?: string) {
  if (!isDbEnabled()) return Promise.resolve();
  const scoreDate = date ?? new Date().toISOString().slice(0, 10);
  if (!hydrateInflight) {
    hydrateInflight = hydrateForDate(organizationId, scoreDate).catch(() => undefined).then(() => undefined);
  }
  return hydrateInflight;
}

export async function hydrateForDate(organizationId: number, date: string, siteId?: number) {
  if (!isDbEnabled()) return false;
  if (getOverallScore(organizationId, date, siteId)) return true;

  const loaded = await loadDailyScore(organizationId, date, siteId);
  if (!loaded) return false;

  const modR = await dbQuery<{
    id: string;
    module_key: string;
    score: string;
    drivers: unknown;
    weight_profile_id: number | null;
    created_at: Date;
  }>(
    `SELECT id, module_key, score, drivers, weight_profile_id, created_at
     FROM school_daily_module_scores
     WHERE organization_id = $1 AND score_date = $2 AND COALESCE(site_id, 0) = COALESCE($3, 0)`,
    [organizationId, date, siteId ?? null]
  );

  const modules: ModuleScore[] = (modR?.rows ?? []).map((r) => ({
    id: Number(r.id),
    organizationId,
    siteId,
    scoreDate: date,
    moduleKey: r.module_key as ScoreModuleKey,
    score: Number(r.score),
    drivers: (r.drivers as ModuleScore['drivers']) ?? [],
    weightProfileId: r.weight_profile_id ?? undefined,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));

  const snapshot = loaded.moduleScores as ModuleScore[] | { moduleKey: string; score: number }[];
  const moduleScoresFromSnapshot = Array.isArray(snapshot)
    ? snapshot.map((m, i) => ({
        id: modules[i]?.id ?? 9000 + i,
        organizationId,
        siteId,
        scoreDate: date,
        moduleKey: (m as ModuleScore).moduleKey ?? (m as { moduleKey: ScoreModuleKey }).moduleKey,
        score: (m as ModuleScore).score ?? (m as { score: number }).score,
        drivers: (m as ModuleScore).drivers ?? [],
        weightProfileId: loaded.weightProfileId,
        createdAt: new Date().toISOString(),
      }))
    : modules;

  const finalModules = modules.length ? modules : moduleScoresFromSnapshot;
  const daily: DailyOverallScore = {
    id: scoreDb.overallScores().length + 1,
    organizationId,
    siteId,
    scoreDate: date,
    overallScore: loaded.overallScore,
    weightProfileId: loaded.weightProfileId,
    moduleScores: finalModules,
    weights: { ...DEFAULT_WEIGHTS },
    createdAt: new Date().toISOString(),
  };

  scoreDb.overallScores().push(daily);
  for (const m of finalModules) {
    if (!scoreDb.moduleScores().some((x) => x.organizationId === organizationId && x.scoreDate === date && x.moduleKey === m.moduleKey)) {
      scoreDb.moduleScores().push(m);
    }
  }
  return true;
}

export async function hydrateGptForDate(organizationId: number, date: string, siteId?: number) {
  if (!isDbEnabled()) return false;
  if (getCachedDailySummary(organizationId, date, siteId)) return true;
  const row = await loadGptSummary(organizationId, 'daily', date, siteId);
  if (!row) return false;
  const record: GptSummaryRecord = {
    id: gptDb.summaries().length + 1,
    organizationId,
    siteId,
    summaryType: 'daily',
    summaryDate: date,
    content: row.content,
    citations: row.citations as string[],
    model: row.model,
    createdAt: row.createdAt,
  };
  gptDb.summaries().push(record);
  return true;
}
