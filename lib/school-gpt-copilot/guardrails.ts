import type { SchoolGptContext } from './types';

export const MAX_CONTEXT_CHARS = 12_000;

const rateByOrg = new Map<number, { count: number; resetAt: number }>();
const costLog: { organizationId: number; model: string; estimatedTokens: number; at: string }[] = [];

export function resetGptGuardrailsForTests() {
  rateByOrg.clear();
  costLog.length = 0;
}

export function truncateContext(ctx: SchoolGptContext): SchoolGptContext {
  const modules = [...ctx.module_scores].sort((a, b) => a.score - b.score);
  const worst = modules.slice(0, 6);
  const best = modules.filter((m) => !worst.includes(m)).slice(0, 2);
  return {
    ...ctx,
    module_scores: [...worst, ...best],
    summary_facts: ctx.summary_facts.slice(0, 20),
    top_events: ctx.top_events.slice(0, 8),
  };
}

export function shrinkContextJson(ctx: SchoolGptContext): string {
  let current = truncateContext(ctx);
  let json = JSON.stringify(current);
  while (json.length > MAX_CONTEXT_CHARS && current.module_scores.length > 2) {
    current = {
      ...current,
      module_scores: current.module_scores.slice(0, current.module_scores.length - 1),
      summary_facts: current.summary_facts.slice(0, Math.max(4, current.summary_facts.length - 2)),
    };
    json = JSON.stringify(current);
  }
  return json;
}

export function allowedCitationKeys(ctx: SchoolGptContext): Set<string> {
  const keys = new Set<string>([
    'overall_score', 'parent', 'teacher', 'academic', 'occupancy', 'discipline',
    'compliance', 'safety', 'security', 'staff', 'space', 'summary_facts', 'top_events',
  ]);
  for (const m of ctx.module_scores) keys.add(m.key);
  for (const f of ctx.summary_facts) {
    if (f.module) keys.add(f.module);
  }
  return keys;
}

export function validateResponseCitations(text: string, ctx: SchoolGptContext): { ok: boolean; unknown: string[] } {
  const allowed = allowedCitationKeys(ctx);
  const unknown: string[] = [];
  const re = /\[([a-z_]+)\]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const key = m[1].toLowerCase();
    if (!allowed.has(key)) unknown.push(key);
  }
  return { ok: unknown.length === 0, unknown: [...new Set(unknown)] };
}

export function checkRateLimit(organizationId: number, maxPerHour = 60): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  let row = rateByOrg.get(organizationId);
  if (!row || now >= row.resetAt) {
    row = { count: 0, resetAt: now + hour };
    rateByOrg.set(organizationId, row);
  }
  if (row.count >= maxPerHour) {
    return { ok: false, retryAfterSec: Math.ceil((row.resetAt - now) / 1000) };
  }
  row.count += 1;
  return { ok: true };
}

export function logGptCost(organizationId: number, model: string, promptChars: number, responseChars: number) {
  const estimatedTokens = Math.ceil((promptChars + responseChars) / 4);
  costLog.push({ organizationId, model, estimatedTokens, at: new Date().toISOString() });
  return estimatedTokens;
}

export function listGptCostLog(organizationId?: number) {
  return organizationId == null ? [...costLog] : costLog.filter((r) => r.organizationId === organizationId);
}

export function insufficientDataInstruction(ctx: SchoolGptContext): string {
  const emptyDrivers = ctx.module_scores.filter((m) => !m.drivers?.length).map((m) => m.key);
  if (!emptyDrivers.length && ctx.summary_facts.length) return '';
  return 'Several modules lack score drivers or summary facts. State clearly when evidence is insufficient; do not invent causes.';
}
