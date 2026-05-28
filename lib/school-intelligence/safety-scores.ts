
import type { SchoolRawMetrics, SchoolScoreResult } from './types';

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export function calculateSchoolScores(m: SchoolRawMetrics): SchoolScoreResult {
  const cameraHealthScore = clamp(
    (m.onlineCameras / Math.max(m.totalCameras, 1)) * 100 - m.streamDropCount * 2
  );
  const responseScore = clamp(
    100 - m.avgAcknowledgeMinutes * 4 - m.avgResolutionMinutes / 10 - m.slaBreaches * 5
  );
  const complianceScore = clamp(100 - m.slaBreaches * 8 - m.afterHoursViolations * 2);
  const physicalSecurityScore = clamp(
    100 - m.intrusionAlerts * 0.5 - m.perimeterAlerts * 0.8 - m.afterHoursViolations
  );
  const campusSafetyScore = clamp(
    (physicalSecurityScore + responseScore + complianceScore + cameraHealthScore) / 4
  );
  return {
    campusSafetyScore,
    physicalSecurityScore,
    responseScore,
    complianceScore,
    cameraHealthScore,
  };
}

export const DEMO_METRICS: SchoolRawMetrics = {
  intrusionAlerts: 14,
  perimeterAlerts: 9,
  avgAcknowledgeMinutes: 6.2,
  avgResolutionMinutes: 118,
  slaBreaches: 3,
  totalCameras: 48,
  onlineCameras: 45,
  streamDropCount: 6,
  afterHoursViolations: 7,
  activeAlerts: 11,
  openIncidents: 8,
};
