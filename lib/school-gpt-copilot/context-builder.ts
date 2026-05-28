import { getDailyOverview } from '../school-daily-summaries/store';
import { getOverallScore, listModuleScores } from '../school-score-engine/store';
import { MODULE_LABELS } from '../school-score-engine/weights';
import type { ScoreModuleKey } from '../school-score-engine/types';
import { listEvents } from '../school-rule-engine/store';
import { CONTRACT_VERSION, type SchoolGptContext } from './types';
import { insufficientDataInstruction, shrinkContextJson } from './guardrails';

export type BuildContextResult =
  | { ok: true; context: SchoolGptContext }
  | { ok: false; error: string; code: 'missing_summaries' | 'missing_scores' };

export function buildGptContext(
  organizationId: number,
  date: string,
  siteId?: number,
  timezone = 'Asia/Kolkata'
): BuildContextResult {
  const overview = getDailyOverview(organizationId, date, siteId);
  if (!overview.scoreInputs) {
    return { ok: false, error: 'Phase 4 daily summaries missing for this date.', code: 'missing_summaries' };
  }

  const overall = getOverallScore(organizationId, date, siteId);
  if (!overall) {
    return { ok: false, error: 'Phase 5 scores missing. Run POST /api/school-scores/calculate first.', code: 'missing_scores' };
  }

  const moduleRows = listModuleScores(organizationId, date, siteId);
  const module_scores = moduleRows.map((m) => ({
    key: m.moduleKey,
    label: MODULE_LABELS[m.moduleKey as ScoreModuleKey] ?? m.moduleKey,
    score: m.score,
    weight: overall.weights[m.moduleKey as ScoreModuleKey],
    drivers: m.drivers,
  }));

  const summary_facts = overview.modules.flatMap((mod) =>
    mod.facts.map((f) => ({ module: mod.module, text: f.text }))
  );

  const from = `${date}T00:00:00.000Z`;
  const to = `${date}T23:59:59.999Z`;
  const events = listEvents(organizationId, { from, to })
    .sort((a, b) => {
      const sev = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      return (sev[b.severity] ?? 0) - (sev[a.severity] ?? 0);
    })
    .slice(0, 8);

  const top_events = events.map((e) => {
    let durationMinutes: number | undefined;
    if (e.endedAt) {
      durationMinutes = Math.round((new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime()) / 60000);
    }
    return {
      eventType: e.eventType,
      severity: e.severity,
      durationMinutes,
      summary: e.evidence.summary,
    };
  });

  return {
    ok: true,
    context: {
      contract_version: CONTRACT_VERSION,
      date,
      org_id: organizationId,
      site_id: siteId,
      timezone,
      overall_score: overall.overallScore,
      module_scores,
      summary_facts,
      top_events,
    },
  };
}

export function buildCopilotPrompt(context: SchoolGptContext, userQuestion?: string) {
  const ctx = shrinkContextJson(context);
  const q = userQuestion?.trim() ?? 'Generate a principal-friendly daily management summary.';
  const dataHint = insufficientDataInstruction(context);
  const hintLine = dataHint ? `- ${dataHint}\n` : '';
  return `You are a School Intelligence GPT assistant for school leadership.

Use ONLY the structured context below. Do not invent facts, scores, or events not present in the JSON.
Cite module keys when referencing scores or facts.

\`\`\`json
${ctx}
\`\`\`

User request: ${q}

Rules:
- Principal-friendly tone; concise bullets where helpful.
- If data is insufficient, say so clearly.
- Do not identify students by name or analyze raw video.
- Reference dispersal/gate issues only if parent module facts or events support it.
${hintLine}`;
}
