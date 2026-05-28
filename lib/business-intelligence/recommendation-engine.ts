// Deterministic recommendation engine — produces management action cards
// from calculated BI scores and raw metrics.

import type { BIScores, RawMetrics } from './score-calculator';

export type RecommendationPriority = 'High' | 'Medium' | 'Low';
export type RecommendationCategory =
  | 'Operator Staffing'
  | 'Camera Maintenance'
  | 'Alert Rule Tuning'
  | 'SLA Improvement'
  | 'High-Risk Area Monitoring'
  | 'Site Safety Improvement'
  | 'Compliance Improvement';

export interface Recommendation {
  id: string;
  title: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  impactArea: string;
  reason: string;
  suggestedAction: string;
  expectedBenefit: string;
}

export function generateRecommendations(
  scores: BIScores,
  metrics: RawMetrics
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (scores.responseScore < 70) {
    recs.push({
      id: 'rec-response-ack',
      title: 'Improve operator acknowledgment time',
      category: 'Operator Staffing',
      priority: 'High',
      impactArea: 'Response Score + SLA',
      reason: `Average acknowledgment time is ${metrics.avgAcknowledgeMinutes.toFixed(1)} min against a 5-min SLA target.`,
      suggestedAction:
        'Review operator shift schedule, add coverage during peak alert hours, and configure escalation alerts for unacknowledged events.',
      expectedBenefit: 'Reduce acknowledgment time below 5 minutes and improve SLA compliance.',
    });
  }

  if (metrics.offlineCriticalCameras > 0) {
    recs.push({
      id: 'rec-camera-offline',
      title: `Restore ${metrics.offlineCriticalCameras} offline critical camera(s)`,
      category: 'Camera Maintenance',
      priority: 'High',
      impactArea: 'Camera Health + Safety Score',
      reason: `${metrics.offlineCriticalCameras} camera(s) in critical areas are offline, creating blind spots.`,
      suggestedAction:
        'Dispatch maintenance team to check network cables, switch ports, and stream profiles on offline cameras.',
      expectedBenefit: 'Eliminate critical area blind spots and improve camera health score.',
    });
  }

  if (metrics.streamDropCount > 10) {
    recs.push({
      id: 'rec-stream-drops',
      title: 'Investigate frequent stream drops',
      category: 'Camera Maintenance',
      priority: 'Medium',
      impactArea: 'Camera Health + Evidence Reliability',
      reason: `${metrics.streamDropCount} stream drops recorded in the period, affecting evidence clip quality.`,
      suggestedAction:
        'Review network bandwidth, camera stream profiles, and edge server load for affected cameras.',
      expectedBenefit: 'Improve stream stability and evidence reliability.',
    });
  }

  if (metrics.repeatedAlerts > 20) {
    recs.push({
      id: 'rec-repeated-alerts',
      title: 'Tune alert rules to reduce repeated alerts',
      category: 'Alert Rule Tuning',
      priority: metrics.repeatedAlerts > 50 ? 'High' : 'Medium',
      impactArea: 'Operator Workload + Response Score',
      reason: `${metrics.repeatedAlerts} repeated alerts detected — operators may be experiencing alert fatigue.`,
      suggestedAction:
        'Review rules generating repeated alerts. Create time-based schedules and adjust sensitivity thresholds during known low-risk periods.',
      expectedBenefit: 'Reduce false alert volume and focus operator attention on genuine threats.',
    });
  }

  if (metrics.slaBreaches > 5) {
    recs.push({
      id: 'rec-sla-breaches',
      title: 'Address SLA response breaches',
      category: 'SLA Improvement',
      priority: 'High',
      impactArea: 'Compliance Score + Response Score',
      reason: `${metrics.slaBreaches} SLA breaches recorded — incidents not resolved within target time.`,
      suggestedAction:
        'Configure escalation policies so unresolved alerts automatically escalate to supervisors after SLA threshold.',
      expectedBenefit: 'Improve SLA adherence and compliance score.',
    });
  }

  if (scores.safetyScore < 75) {
    recs.push({
      id: 'rec-safety-review',
      title: 'Conduct site safety review',
      category: 'Site Safety Improvement',
      priority: 'High',
      impactArea: 'Safety Score + Risk Level',
      reason: `Safety score is ${scores.safetyScore}/100 — below acceptable threshold of 75.`,
      suggestedAction:
        'Schedule a site safety review focusing on critical alert areas, unresolved incidents, and high-risk zones.',
      expectedBenefit: 'Improve overall safety posture and reduce operational risk.',
    });
  }

  if (scores.complianceScore < 80) {
    recs.push({
      id: 'rec-compliance',
      title: 'Improve alert handling completeness',
      category: 'Compliance Improvement',
      priority: 'Medium',
      impactArea: 'Compliance Score',
      reason: `Compliance score is ${scores.complianceScore}/100 — unresolved incidents or missed responses are affecting score.`,
      suggestedAction:
        'Ensure all alerts are acknowledged and closed with proper resolution notes. Review incident closure workflows.',
      expectedBenefit: 'Improve compliance score and audit readiness.',
    });
  }

  // Always return at least a placeholder if no issues found
  if (recs.length === 0) {
    recs.push({
      id: 'rec-maintain',
      title: 'Maintain current operational standards',
      category: 'Site Safety Improvement',
      priority: 'Low',
      impactArea: 'All Areas',
      reason: 'All scores are within acceptable ranges. Continue monitoring for emerging risks.',
      suggestedAction:
        'Continue regular camera health checks, maintain operator response times, and review alert rules monthly.',
      expectedBenefit: 'Sustain high performance and prevent score degradation.',
    });
  }

  return recs;
}
