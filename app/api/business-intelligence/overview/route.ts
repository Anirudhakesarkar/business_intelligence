import '@/lib/school-persistence/init';
import { NextRequest, NextResponse } from 'next/server';
import { calculateAllScores, DEMO_SCORES, type RawMetrics } from '@/lib/business-intelligence/score-calculator';
import { generateRecommendations } from '@/lib/business-intelligence/recommendation-engine';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const organizationId = searchParams.get('organizationId');
  const siteId = searchParams.get('siteId');
  const dateRange = searchParams.get('dateRange') ?? '7d';

  // In production: query DB using organizationId, siteId, dateRange to build RawMetrics.
  // For now, return structured placeholder so pages never appear blank.
  const demoMetrics: RawMetrics = {
    totalAlerts: 247,
    criticalAlerts: 18,
    repeatedAlerts: 61,
    unacknowledgedAlerts: 9,
    avgAcknowledgeMinutes: 7.4,
    avgResolutionMinutes: 148,
    slaBreaches: 4,
    autoClosed: 24,
    totalCameras: 24,
    onlineCameras: 22,
    streamDropCount: 8,
    offlineCriticalCameras: 1,
    edgeServerUptime: 98,
    openIncidents: 12,
    unresolvedIncidentCount: 4,
    avgIncidentAgeDays: 2.1,
    criticalAreaAlerts: 18,
  };

  const scores = calculateAllScores(demoMetrics);
  const recommendations = generateRecommendations(scores, demoMetrics).slice(0, 5);

  return NextResponse.json({
    organizationId,
    siteId,
    dateRange,
    scores,
    openIncidents: demoMetrics.openIncidents,
    totalAlerts: demoMetrics.totalAlerts,
    summary:
      'Site safety is good but response time needs improvement during evening hours. Main Gate and Parking Area are generating repeated alerts. Camera health is stable, but one camera has intermittent stream drops.',
    topRiskAreas: [
      { name: 'Main Gate', category: 'Entrance / Exit', riskLevel: 'High', alertCount: 42, insight: 'Repeated after-hours intrusion alerts. Consider stricter evening rule schedule.' },
      { name: 'Parking Area', category: 'External Zone', riskLevel: 'Medium', alertCount: 18, insight: 'Weekend alert frequency is 3× weekday levels.' },
    ],
    alertTrend: null,
    cameraHealth: {
      total: demoMetrics.totalCameras,
      online: demoMetrics.onlineCameras,
      streamDrops: demoMetrics.streamDropCount,
      offlineCritical: demoMetrics.offlineCriticalCameras,
    },
    recommendations,
  });
}
