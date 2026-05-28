// Builds structured insight summaries from raw metrics for GPT context.
// GPT receives these summaries — not raw SQL data.

import type { BIScores, RawMetrics } from './score-calculator';

export interface InsightContext {
  organizationId: number;
  siteId?: number;
  dateFrom: string;
  dateTo: string;
  scores: BIScores;
  metrics: RawMetrics;
  topRiskAreas: Array<{ name: string; riskLevel: string; alertCount: number }>;
  cameraIssues: Array<{ cameraId: string; issue: string; count: number }>;
}

export function buildContextSummary(ctx: InsightContext): string {
  const { scores, metrics, topRiskAreas, cameraIssues } = ctx;
  const lines: string[] = [
    `Period: ${ctx.dateFrom} to ${ctx.dateTo}`,
    `Safety Score: ${scores.safetyScore}/100`,
    `Camera Health Score: ${scores.cameraHealthScore}/100`,
    `Response Score: ${scores.responseScore}/100`,
    `Compliance Score: ${scores.complianceScore}/100`,
    `Operational Risk: ${scores.operationalRiskScore}/100 (${scores.riskLevel})`,
    '',
    `Total Alerts: ${metrics.totalAlerts}`,
    `Critical Alerts: ${metrics.criticalAlerts}`,
    `Repeated Alerts: ${metrics.repeatedAlerts}`,
    `Unacknowledged Alerts: ${metrics.unacknowledgedAlerts}`,
    `Avg Acknowledge Time: ${metrics.avgAcknowledgeMinutes.toFixed(1)} min`,
    `Avg Resolution Time: ${metrics.avgResolutionMinutes.toFixed(1)} min`,
    `SLA Breaches: ${metrics.slaBreaches}`,
    `Open Incidents: ${metrics.openIncidents}`,
    '',
    `Cameras Online: ${metrics.onlineCameras}/${metrics.totalCameras}`,
    `Stream Drops: ${metrics.streamDropCount}`,
    `Offline Critical Cameras: ${metrics.offlineCriticalCameras}`,
  ];

  if (topRiskAreas.length > 0) {
    lines.push('', 'Top Risk Areas:');
    topRiskAreas.forEach((a) => {
      lines.push(`  - ${a.name}: ${a.riskLevel} risk, ${a.alertCount} alerts`);
    });
  }

  if (cameraIssues.length > 0) {
    lines.push('', 'Camera Issues:');
    cameraIssues.forEach((c) => {
      lines.push(`  - Camera ${c.cameraId}: ${c.issue} (${c.count} times)`);
    });
  }

  return lines.join('\n');
}

export function buildGptSystemPrompt(): string {
  return `You are an Orion Alerts Business Intelligence assistant. You analyze structured security and operational data to help management understand site performance, risk, and what to improve.

Rules:
- Base all answers on the provided structured context summary only.
- Do not fabricate data or metrics.
- Provide clear, management-friendly language.
- Always offer a specific recommended action when possible.
- Keep answers concise and actionable.`;
}
