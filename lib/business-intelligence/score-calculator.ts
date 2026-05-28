// Deterministic BI score calculator — no GPT dependency for score math.
// GPT/AI receives these pre-calculated scores to explain, not to calculate.

export interface RawMetrics {
  // Alerts
  totalAlerts: number;
  criticalAlerts: number;
  repeatedAlerts: number;
  unacknowledgedAlerts: number;
  avgAcknowledgeMinutes: number;
  avgResolutionMinutes: number;
  slaBreaches: number;
  autoClosed: number;
  // Cameras
  totalCameras: number;
  onlineCameras: number;
  streamDropCount: number;
  offlineCriticalCameras: number;
  edgeServerUptime: number; // 0-100 percent
  // Incidents
  openIncidents: number;
  unresolvedIncidentCount: number;
  avgIncidentAgeDays: number;
  // Area
  criticalAreaAlerts: number;
}

export interface BIScores {
  safetyScore: number;
  cameraHealthScore: number;
  responseScore: number;
  complianceScore: number;
  operationalRiskScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
}

export function calculateSafetyScore(m: RawMetrics): number {
  let score = 100;
  score -= Math.min(30, m.criticalAlerts * 3);
  score -= Math.min(20, m.unresolvedIncidentCount * 4);
  score -= Math.min(10, m.repeatedAlerts * 0.5);
  score -= Math.min(15, m.criticalAreaAlerts * 2);
  score -= Math.min(10, m.slaBreaches * 2);
  return Math.max(0, Math.round(score));
}

export function calculateCameraHealthScore(m: RawMetrics): number {
  if (m.totalCameras === 0) return 0;
  const onlinePct = (m.onlineCameras / m.totalCameras) * 100;
  let score = onlinePct;
  score -= Math.min(15, m.streamDropCount * 0.5);
  score -= Math.min(20, m.offlineCriticalCameras * 10);
  // Edge server uptime contributes up to 10 pts
  score = score * 0.9 + (m.edgeServerUptime / 100) * 10;
  return Math.max(0, Math.round(score));
}

export function calculateResponseScore(m: RawMetrics): number {
  let score = 100;
  // Ack time penalty: >5 min = deduct, max 25 pts
  if (m.avgAcknowledgeMinutes > 5) {
    score -= Math.min(25, (m.avgAcknowledgeMinutes - 5) * 2);
  }
  // Resolution time penalty: >120 min = deduct, max 25 pts
  if (m.avgResolutionMinutes > 120) {
    score -= Math.min(25, Math.floor((m.avgResolutionMinutes - 120) / 30) * 3);
  }
  score -= Math.min(20, m.slaBreaches * 3);
  score -= Math.min(15, m.unacknowledgedAlerts * 2);
  score -= Math.min(10, m.avgIncidentAgeDays * 2);
  return Math.max(0, Math.round(score));
}

export function calculateComplianceScore(m: RawMetrics): number {
  let score = 100;
  score -= Math.min(20, m.slaBreaches * 4);
  score -= Math.min(20, m.unresolvedIncidentCount * 3);
  score -= Math.min(15, m.offlineCriticalCameras * 5);
  score -= Math.min(10, m.unacknowledgedAlerts * 1.5);
  return Math.max(0, Math.round(score));
}

export function calculateOperationalRiskScore(m: RawMetrics): number {
  let score = 0;
  score += Math.min(25, m.criticalAlerts * 2.5);
  score += Math.min(20, m.repeatedAlerts * 1);
  score += Math.min(20, m.unresolvedIncidentCount * 4);
  score += Math.min(15, (100 - calculateCameraHealthScore(m)) * 0.15);
  score += Math.min(10, m.criticalAreaAlerts * 1.5);
  score += Math.min(10, m.slaBreaches * 2);
  return Math.min(100, Math.round(score));
}

export function getRiskLevel(riskScore: number): 'Low' | 'Medium' | 'High' {
  if (riskScore <= 30) return 'Low';
  if (riskScore <= 70) return 'Medium';
  return 'High';
}

export function calculateAllScores(m: RawMetrics): BIScores {
  const operationalRiskScore = calculateOperationalRiskScore(m);
  return {
    safetyScore: calculateSafetyScore(m),
    cameraHealthScore: calculateCameraHealthScore(m),
    responseScore: calculateResponseScore(m),
    complianceScore: calculateComplianceScore(m),
    operationalRiskScore,
    riskLevel: getRiskLevel(operationalRiskScore),
  };
}

/** Demo/placeholder scores when no live data is available */
export const DEMO_SCORES: BIScores = {
  safetyScore: 86,
  cameraHealthScore: 94,
  responseScore: 78,
  complianceScore: 82,
  operationalRiskScore: 42,
  riskLevel: 'Medium',
};
