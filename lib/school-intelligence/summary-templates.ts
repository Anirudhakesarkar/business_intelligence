
import type { SchoolScoreResult } from './types';

export function buildOverviewSummary(scores: SchoolScoreResult): string {
  return `Campus safety score is ${scores.campusSafetyScore}/100. Physical security is ${
    scores.physicalSecurityScore >= 80 ? 'strong' : 'needs attention'
  } during bell transitions. Review after-hours activity near entrances and playground zones.`;
}

export const PLACEHOLDER_SUMMARY =
  'School intelligence is running on demo data. Connect live alerts and occupancy feeds to replace labeled placeholders.';
