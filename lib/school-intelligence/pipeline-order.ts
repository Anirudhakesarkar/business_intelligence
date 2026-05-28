import { getDailyOverview } from '../school-daily-summaries/store';
import { getOverallScore } from '../school-score-engine/store';
import { listEvents } from '../school-rule-engine/store';

export type PipelinePhaseStatus = {
  phase3_events: boolean;
  phase4_summaries: boolean;
  phase5_scores: boolean;
  gpt_ready: boolean;
};

export function getPipelinePhaseStatus(
  organizationId: number,
  date: string,
  siteId?: number
): PipelinePhaseStatus {
  const from = `${date}T00:00:00.000Z`;
  const to = `${date}T23:59:59.999Z`;
  const overview = getDailyOverview(organizationId, date, siteId);
  const overall = getOverallScore(organizationId, date, siteId);
  const events = listEvents(organizationId, { from, to });
  const phase4_summaries = overview.scoreInputs != null;
  const phase5_scores = overall != null;
  return {
    phase3_events: events.length > 0,
    phase4_summaries,
    phase5_scores,
    gpt_ready: phase4_summaries && phase5_scores,
  };
}

export function assertScoresAfterSummaries(organizationId: number, date: string, siteId?: number): string | null {
  const status = getPipelinePhaseStatus(organizationId, date, siteId);
  if (status.phase5_scores && !status.phase4_summaries) {
    return 'Scores exist without Phase 4 daily summaries (pipeline order violation).';
  }
  return null;
}

export function assertGptAfterScores(organizationId: number, date: string, siteId?: number): string | null {
  const status = getPipelinePhaseStatus(organizationId, date, siteId);
  if (!status.gpt_ready) {
    if (!status.phase4_summaries) return 'GPT requires Phase 4 daily summaries first.';
    if (!status.phase5_scores) return 'GPT requires Phase 5 scores first.';
  }
  return null;
}
