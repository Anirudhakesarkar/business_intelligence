import { dailyDb, getDailyOverview } from '../school-daily-summaries/store';
import { DEFAULT_WEIGHTS, normalizeWeights } from './weights';
import { logAudit } from '../school-foundation/store';
import { effectiveWeightsForOverall, mvp3ScoresOnly } from './flags';
import { computeAllModuleScores, computeOverallScore } from './calculate';
import { persistDailyScore } from '../school-db/persist-scores-gpt';
import type { DailyOverallScore, ModuleScore, ScoreModuleKey, WeightProfile } from './types';

let nextModuleId = 1;
let nextOverallId = 1;
let nextProfileId = 1;

const moduleScores: ModuleScore[] = [];
const overallScores: DailyOverallScore[] = [];
const weightProfiles: WeightProfile[] = [];

const now = () => new Date().toISOString();

export function getActiveWeightProfile(organizationId: number, date: string) {
  return activeProfile(organizationId, date);
}

function activeProfile(organizationId: number, date: string): WeightProfile {
  const candidates = weightProfiles
    .filter((p) => p.organizationId === organizationId && p.effectiveFrom <= date)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  if (candidates[0]) return candidates[0];
  if (!weightProfiles.some((p) => p.organizationId === organizationId)) {
    weightProfiles.push({
      id: nextProfileId++,
      organizationId,
      profileName: 'default',
      effectiveFrom: '2020-01-01',
      weights: { ...DEFAULT_WEIGHTS },
      createdAt: now(),
    });
  }
  return weightProfiles.find((p) => p.organizationId === organizationId)!;
}

function purgeScores(organizationId: number, date: string, siteId?: number) {
  for (let i = moduleScores.length - 1; i >= 0; i--) {
    const r = moduleScores[i];
    if (r.organizationId === organizationId && r.scoreDate === date && (siteId == null || r.siteId === siteId)) {
      moduleScores.splice(i, 1);
    }
  }
  for (let i = overallScores.length - 1; i >= 0; i--) {
    const r = overallScores[i];
    if (r.organizationId === organizationId && r.scoreDate === date && (siteId == null || r.siteId === siteId)) {
      overallScores.splice(i, 1);
    }
  }
}

export function listWeightProfiles(organizationId: number) {
  return weightProfiles.filter((p) => p.organizationId === organizationId);
}

export function createWeightProfile(
  organizationId: number,
  effectiveFrom: string,
  weights: Record<ScoreModuleKey, number>,
  profileName = 'custom'
) {
  const profile: WeightProfile = {
    id: nextProfileId++,
    organizationId,
    profileName,
    effectiveFrom,
    weights: normalizeWeights(weights),
    createdAt: now(),
  };
  weightProfiles.push(profile);
  logAudit('create', 'score_weight_profile', profile.id, profile);
  return profile;
}

export function calculateScoresForDay(organizationId: number, date: string, siteId?: number) {
  const overview = getDailyOverview(organizationId, date, siteId);
  const inputs = (overview.scoreInputs?.inputsJson ?? {}) as Record<string, unknown>;
  if (!overview.scoreInputs) {
    return { skipped: true, reason: 'no_phase4_inputs' as const, date, organizationId };
  }

  const profile = activeProfile(organizationId, date);
  const computed = computeAllModuleScores(organizationId, date, inputs);
  purgeScores(organizationId, date, siteId);

  const modules: ModuleScore[] = (Object.keys(computed) as ScoreModuleKey[]).map((moduleKey) => {
    const row: ModuleScore = {
      id: nextModuleId++,
      organizationId,
      siteId,
      scoreDate: date,
      moduleKey,
      score: computed[moduleKey].score,
      drivers: computed[moduleKey].drivers,
      weightProfileId: profile.id,
      createdAt: now(),
    };
    moduleScores.push(row);
    return row;
  });

  const effectiveWeights = effectiveWeightsForOverall(profile.weights, mvp3ScoresOnly());
  const overallScore = computeOverallScore(computed, effectiveWeights);
  const daily: DailyOverallScore = {
    id: nextOverallId++,
    organizationId,
    siteId,
    scoreDate: date,
    overallScore,
    weightProfileId: profile.id,
    moduleScores: modules,
    weights: effectiveWeights,
    mvp3Mode: mvp3ScoresOnly(),
    createdAt: now(),
  };
  overallScores.push(daily);
  void persistDailyScore(daily);

  return { skipped: false, organizationId, date, siteId, overall: daily, modules };
}

export function getOverallScore(organizationId: number, date: string, siteId?: number) {
  return overallScores.find(
    (r) => r.organizationId === organizationId && r.scoreDate === date && (siteId == null || r.siteId === siteId)
  );
}

export function getModuleScore(organizationId: number, date: string, moduleKey: ScoreModuleKey, siteId?: number) {
  return moduleScores.find(
    (r) =>
      r.organizationId === organizationId &&
      r.scoreDate === date &&
      r.moduleKey === moduleKey &&
      (siteId == null || r.siteId === siteId)
  );
}

export function listModuleScores(organizationId: number, date: string, siteId?: number) {
  return moduleScores.filter(
    (r) => r.organizationId === organizationId && r.scoreDate === date && (siteId == null || r.siteId === siteId)
  );
}


export function getOverallTrend(organizationId: number, endDate: string, days = 7, siteId?: number) {
  const points: { date: string; score: number | null; weightProfileId?: number }[] = [];
  const end = new Date(`${endDate}T12:00:00.000Z`);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    const row = getOverallScore(organizationId, date, siteId);
    points.push({ date, score: row?.overallScore ?? null, weightProfileId: row?.weightProfileId });
  }
  return { organizationId, endDate, days, points };
}

export function getOverallCompare(organizationId: number, date: string, siteId?: number) {
  const current = getOverallScore(organizationId, date, siteId);
  const priorEnd = new Date(`${date}T12:00:00.000Z`);
  priorEnd.setUTCDate(priorEnd.getUTCDate() - 7);
  const priorDate = priorEnd.toISOString().slice(0, 10);
  const prior = getOverallScore(organizationId, priorDate, siteId);
  const delta =
    current?.overallScore != null && prior?.overallScore != null
      ? current.overallScore - prior.overallScore
      : null;
  return {
    organizationId,
    date,
    priorDate,
    current: current ?? null,
    prior: prior ?? null,
    delta,
    moduleDeltas: (current?.moduleScores ?? []).map((m) => {
      const p = prior?.moduleScores.find((x) => x.moduleKey === m.moduleKey);
      return { moduleKey: m.moduleKey, current: m.score, prior: p?.score ?? null, delta: p ? m.score - p.score : null };
    }),
  };
}

export function resetScoreEngineStore() {
  moduleScores.length = 0;
  overallScores.length = 0;
  weightProfiles.length = 0;
  nextModuleId = 1;
  nextOverallId = 1;
  nextProfileId = 1;
}



export function priorSchoolDate(endDate: string) {
  const d = new Date(`${endDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function getModuleScoreDetail(
  organizationId: number,
  date: string,
  moduleKey: ScoreModuleKey,
  siteId?: number
) {
  const row = getModuleScore(organizationId, date, moduleKey, siteId);
  const priorDate = priorSchoolDate(date);
  const prior = getModuleScore(organizationId, priorDate, moduleKey, siteId);
  const trend_delta =
    row?.score != null && prior?.score != null ? row.score - prior.score : null;
  const drivers = (row?.drivers ?? []).slice(0, 5);
  return {
    moduleKey,
    date,
    organizationId,
    siteId,
    score: row?.score ?? null,
    priorScore: prior?.score ?? null,
    priorDate,
    trend_delta,
    top_drivers: drivers,
    weightProfileId: row?.weightProfileId,
  };
}

export function getModuleScoreHistory(
  organizationId: number,
  moduleKey: ScoreModuleKey,
  endDate: string,
  days = 7,
  siteId?: number
) {
  const out: { date: string; score: number }[] = [];
  const end = new Date(`${endDate}T12:00:00.000Z`);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    const row = getModuleScore(organizationId, date, moduleKey, siteId);
    if (row) out.push({ date, score: row.score });
  }
  return out;
}

export const scoreDb = {
  moduleScores: () => moduleScores,
  overallScores: () => overallScores,
  weightProfiles: () => weightProfiles,
  dailyInputs: () => dailyDb.scoreInputs(),
};
