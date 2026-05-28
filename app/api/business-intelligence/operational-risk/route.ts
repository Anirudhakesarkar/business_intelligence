import '@/lib/school-persistence/init';
import { NextRequest, NextResponse } from 'next/server';
import { calculateOperationalRiskScore, getRiskLevel, type RawMetrics } from '@/lib/business-intelligence/score-calculator';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const dateRange = searchParams.get('dateRange') ?? '7d';

  const metrics: RawMetrics = {
    totalAlerts: 85, criticalAlerts: 12, repeatedAlerts: 42, unacknowledgedAlerts: 9,
    avgAcknowledgeMinutes: 9.1, avgResolutionMinutes: 190, slaBreaches: 8, autoClosed: 14,
    totalCameras: 24, onlineCameras: 22, streamDropCount: 8, offlineCriticalCameras: 1,
    edgeServerUptime: 97, openIncidents: 12, unresolvedIncidentCount: 6,
    avgIncidentAgeDays: 3.4, criticalAreaAlerts: 22,
  };

  const riskScore = calculateOperationalRiskScore(metrics);
  const riskLevel = getRiskLevel(riskScore);

  return NextResponse.json({
    dateRange,
    riskScore,
    riskLevel,
    highRiskAreas: 2,
    criticalIncidents: 5,
    slaBreaches: metrics.slaBreaches,
    blindSpots: metrics.offlineCriticalCameras,
    risks: [
      {
        title: 'Main Gate',
        riskLevel: 'High',
        reason: [
          '18 intrusion alerts in 7 days',
          '4 alerts not acknowledged within SLA',
          'Camera health dropped twice',
          'Area marked Critical',
        ],
      },
      {
        title: 'Parking Area',
        riskLevel: 'Medium',
        reason: ['11 repeated alerts this week', 'Average resolution time: 3.2 hours'],
      },
    ],
  });
}
