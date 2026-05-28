import '@/lib/school-persistence/init';
import { NextRequest, NextResponse } from 'next/server';
import { calculateAllScores, type RawMetrics } from '@/lib/business-intelligence/score-calculator';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const dateRange = searchParams.get('dateRange') ?? '7d';

  const demoMetrics: RawMetrics = {
    totalAlerts: 85, criticalAlerts: 8, repeatedAlerts: 31, unacknowledgedAlerts: 5,
    avgAcknowledgeMinutes: 7.8, avgResolutionMinutes: 148, slaBreaches: 4, autoClosed: 14,
    totalCameras: 24, onlineCameras: 22, streamDropCount: 8, offlineCriticalCameras: 1,
    edgeServerUptime: 98, openIncidents: 12, unresolvedIncidentCount: 4,
    avgIncidentAgeDays: 2.1, criticalAreaAlerts: 18,
  };

  const scores = calculateAllScores(demoMetrics);

  return NextResponse.json({
    dateRange,
    scores,
    sites: [
      { siteName: 'Hannur Branch', safetyScore: 86, responseScore: 72, cameraHealthScore: 94, complianceScore: 81, riskLevel: 'Medium', trend: 'up' },
      { siteName: 'MG Road Office', safetyScore: 91, responseScore: 88, cameraHealthScore: 98, complianceScore: 90, riskLevel: 'Low', trend: 'stable' },
      { siteName: 'Koramangala Site', safetyScore: 64, responseScore: 55, cameraHealthScore: 78, complianceScore: 68, riskLevel: 'High', trend: 'down' },
    ],
    alertTrend: null,
  });
}
