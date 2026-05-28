import { allowedCitationKeys } from './guardrails';
import type { SchoolGptContext } from './types';

const WEEKLY_ONLY = new Set(['weekly_aggregate']);

export function verifyCitationsAgainstContext(
  ctx: SchoolGptContext,
  citations: string[],
  opts?: { weekly?: boolean }
): { ok: boolean; invalid: string[] } {
  const allowed = allowedCitationKeys(ctx);
  if (opts?.weekly) WEEKLY_ONLY.forEach((k) => allowed.add(k));
  const invalid = citations.filter((c) => !allowed.has(c));
  return { ok: invalid.length === 0, invalid: [...new Set(invalid)] };
}

/** Keep only citation keys backed by the prepared Phase 4–5 context for this date. */
export function filterVerifiableCitations(
  ctx: SchoolGptContext,
  citations: string[],
  opts?: { weekly?: boolean }
): string[] {
  const allowed = allowedCitationKeys(ctx);
  if (opts?.weekly) WEEKLY_ONLY.forEach((k) => allowed.add(k));
  return [...new Set(citations.filter((c) => allowed.has(c)))];
}
