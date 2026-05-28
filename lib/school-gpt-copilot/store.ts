import { buildGptContext } from './context-builder';
import { filterVerifiableCitations } from './citation-verify';
import { assertGptAfterScores } from '../school-intelligence/pipeline-order';
import { db } from '../school-foundation/store';
import { logAudit } from '../school-foundation/store';
import { persistGptSummary } from '../school-db/persist-scores-gpt';
import {
  answerQuestion,
  generateDailyPrincipalSummary,
  generateRecommendations,
  generateWeeklySummary,
} from './service';
import type { GptActionTask, GptChatMessage, GptRecommendation, GptSummaryRecord } from './types';

let nextSummaryId = 1;
let nextRecId = 1;
let nextActionId = 1;
let nextChatId = 1;

const summaries: GptSummaryRecord[] = [];
const recommendations: GptRecommendation[] = [];
const actions: GptActionTask[] = [];
const chats: GptChatMessage[] = [];

const now = () => new Date().toISOString();

function summaryKey(org: number, type: string, date: string, siteId?: number) {
  return `${org}:${type}:${date}:${siteId ?? 0}`;
}

export function getCachedDailySummary(organizationId: number, date: string, siteId?: number) {
  return summaries.find(
    (s) =>
      s.organizationId === organizationId &&
      s.summaryType === 'daily' &&
      s.summaryDate === date &&
      (siteId == null || s.siteId === siteId)
  );
}

export function getCachedWeeklySummary(organizationId: number, weekStart: string, siteId?: number) {
  return summaries.find(
    (s) =>
      s.organizationId === organizationId &&
      s.summaryType === 'weekly' &&
      s.weekStart === weekStart &&
      (siteId == null || s.siteId === siteId)
  );
}


export async function getOrCreateDailySummary(organizationId: number, date: string, siteId?: number) {
  const cached = getCachedDailySummary(organizationId, date, siteId);
  if (cached) return { ok: true as const, summary: cached, cached: true };
  return regenerateDailySummary(organizationId, date, siteId);
}

export async function regenerateDailySummary(organizationId: number, date: string, siteId?: number) {
  const orderErr = assertGptAfterScores(organizationId, date, siteId);
  if (orderErr) return { ok: false as const, error: orderErr, code: 'pipeline_order' as const };
  const built = buildGptContext(organizationId, date, siteId);
  if (!built.ok) return built;

  const { content, citations: rawCitations, model } = await generateDailyPrincipalSummary(built.context);
  const citations = filterVerifiableCitations(built.context, rawCitations);
  const idx = summaries.findIndex(
    (s) =>
      s.organizationId === organizationId &&
      s.summaryType === 'daily' &&
      s.summaryDate === date &&
      (siteId == null || s.siteId === siteId)
  );
  const row: GptSummaryRecord = {
    id: idx >= 0 ? summaries[idx].id : nextSummaryId++,
    organizationId,
    siteId,
    summaryType: 'daily',
    summaryDate: date,
    content,
    citations,
    model,
    createdAt: now(),
  };
  if (idx >= 0) summaries[idx] = row;
  else summaries.push(row);

  refreshRecommendations(organizationId, date, siteId, built.context);
  logAudit('create', 'gpt_daily_summary', row.id, { model: row.model, citations: row.citations });
  void persistGptSummary(row);
  return { ok: true as const, summary: row, context: built.context };
}

function refreshRecommendations(organizationId: number, date: string, siteId: number | undefined, ctx: import('./types').SchoolGptContext) {
  for (let i = recommendations.length - 1; i >= 0; i--) {
    const r = recommendations[i];
    if (r.organizationId === organizationId && r.summaryDate === date && (siteId == null || r.siteId === siteId)) {
      recommendations.splice(i, 1);
    }
  }
  for (const rec of generateRecommendations(ctx)) {
    recommendations.push({
      id: nextRecId++,
      organizationId,
      ...rec,
      createdAt: now(),
    });
  }
}

export function getOrCreateWeeklySummary(organizationId: number, weekStart: string, siteId?: number) {
  const cached = getCachedWeeklySummary(organizationId, weekStart, siteId);
  if (cached) return { ok: true as const, summary: cached };

  const contexts = [];
  const start = new Date(`${weekStart}T12:00:00.000Z`);
  for (let i = 0; i < 7 && contexts.length < 5; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    const cal = db.calendar().find((c) => c.organizationId === organizationId && c.calendarDate === date);
    if (cal?.dayType === 'Holiday') continue;
    const built = buildGptContext(organizationId, date, siteId);
    if (built.ok) contexts.push(built.context);
  }
  if (!contexts.length) {
    return { ok: false as const, error: 'No Phase 4/5 data for week.', code: 'missing_summaries' as const };
  }

  const { content, citations: rawCitations } = generateWeeklySummary(contexts);
  const citations = filterVerifiableCitations(contexts[0], rawCitations, { weekly: true });
  const row: GptSummaryRecord = {
    id: nextSummaryId++,
    organizationId,
    siteId,
    summaryType: 'weekly',
    summaryDate: weekStart,
    weekStart,
    content,
    citations,
    model: 'demo',
    createdAt: now(),
  };
  summaries.push(row);
  logAudit('create', 'gpt_weekly_summary', row.id, { citations: row.citations, daysIncluded: contexts.length });
  return { ok: true as const, summary: row, daysIncluded: contexts.length };
}

export function listRecommendations(organizationId: number, date: string, siteId?: number) {
  return recommendations.filter(
    (r) => r.organizationId === organizationId && r.summaryDate === date && (siteId == null || r.siteId === siteId)
  );
}

export async function askGpt(
  organizationId: number,
  date: string,
  question: string,
  conversationId?: string,
  siteId?: number
) {
  const orderErr = assertGptAfterScores(organizationId, date, siteId);
  if (orderErr) return { ok: false as const, error: orderErr, code: 'pipeline_order' as const };
  const built = buildGptContext(organizationId, date, siteId);
  if (!built.ok) return built;
  const { answer, citations: rawCitations, model } = await answerQuestion(built.context, question);
  const citations = filterVerifiableCitations(built.context, rawCitations);
  const conv = conversationId ?? `conv-${organizationId}-${date}`;
  const row: GptChatMessage = {
    id: nextChatId++,
    organizationId,
    conversationId: conv,
    summaryDate: date,
    question,
    answer,
    citations,
    createdAt: now(),
  };
  chats.push(row);
  logAudit('create', 'gpt_chat', row.id, { model, question: question.slice(0, 200), citations });
  return { ok: true as const, answer, citations, conversationId: conv, message: row };
}

export function listChatHistory(organizationId: number, conversationId: string) {
  return chats.filter((c) => c.organizationId === organizationId && c.conversationId === conversationId);
}

export function createActionFromRecommendation(
  organizationId: number,
  recommendationId: number,
  assignee?: string,
  dueDate?: string
) {
  const rec = recommendations.find((r) => r.id === recommendationId && r.organizationId === organizationId);
  if (!rec) return { ok: false as const, error: 'Recommendation not found' };
  const task: GptActionTask = {
    id: nextActionId++,
    organizationId,
    recommendationId,
    summaryDate: rec.summaryDate,
    title: rec.title,
    assignee,
    status: 'open',
    dueDate,
    createdAt: now(),
  };
  actions.push(task);
  logAudit('create', 'gpt_action', task.id, { source: 'recommendation', recommendationId, title: task.title });
  return { ok: true as const, task };
}

export function createAction(
  organizationId: number,
  title: string,
  summaryDate: string,
  assignee?: string,
  dueDate?: string
) {
  const task: GptActionTask = {
    id: nextActionId++,
    organizationId,
    summaryDate,
    title,
    assignee,
    status: 'open',
    dueDate,
    createdAt: now(),
  };
  actions.push(task);
  logAudit('create', 'gpt_action', task.id, { source: 'manual', title: task.title });
  return { ok: true as const, task };
}

export function updateAction(organizationId: number, actionId: number, patch: Partial<Pick<GptActionTask, 'status' | 'assignee' | 'dueDate'>>) {
  const task = actions.find((a) => a.id === actionId && a.organizationId === organizationId);
  if (!task) return { ok: false as const, error: 'Action not found' };
  Object.assign(task, patch);
  if (patch.status === 'completed') task.completedAt = now();
  logAudit('update', 'gpt_action', task.id, { patch });
  return { ok: true as const, task };
}

export function listActions(organizationId: number) {
  return actions.filter((a) => a.organizationId === organizationId);
}

function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function getActionImpact(organizationId: number, actionId: number) {
  const task = actions.find((a) => a.id === actionId && a.organizationId === organizationId);
  if (!task) return { ok: false as const, error: 'Action not found' };
  const beforeDate = shiftDate(task.summaryDate, -7);
  let afterDate = task.completedAt
    ? shiftDate(task.completedAt.slice(0, 10), 7)
    : shiftDate(task.summaryDate, 7);

  const before = buildGptContext(organizationId, beforeDate);
  let after = buildGptContext(organizationId, afterDate);
  if (!after.ok) {
    afterDate = shiftDate(task.summaryDate, 7);
    after = buildGptContext(organizationId, afterDate);
  }

  return {
    ok: true as const,
    task,
    windowDays: 7,
    before: before.ok ? { date: beforeDate, overall: before.context.overall_score, parent: before.context.module_scores.find((m) => m.key === 'parent')?.score } : null,
    after: after.ok ? { date: afterDate, overall: after.context.overall_score, parent: after.context.module_scores.find((m) => m.key === 'parent')?.score } : null,
    delta: {
      overall: after.ok && before.ok && after.context.overall_score != null && before.context.overall_score != null
        ? after.context.overall_score - before.context.overall_score
        : null,
      parent: after.ok && before.ok
        ? (after.context.module_scores.find((m) => m.key === 'parent')?.score ?? 0) -
          (before.context.module_scores.find((m) => m.key === 'parent')?.score ?? 0)
        : null,
    },
  };
}

export function resetGptCopilotStore() {
  summaries.length = 0;
  recommendations.length = 0;
  actions.length = 0;
  chats.length = 0;
  nextSummaryId = 1;
  nextRecId = 1;
  nextActionId = 1;
  nextChatId = 1;
}

export const gptDb = { summaries: () => summaries, recommendations: () => recommendations, actions: () => actions, chats: () => chats };
