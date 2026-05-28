import '@/lib/school-persistence/init';
import { NextRequest, NextResponse } from 'next/server';
import { generateRecommendations } from '@/lib/business-intelligence/recommendation-engine';
import { calculateAllScores, type RawMetrics } from '@/lib/business-intelligence/score-calculator';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const dateRange = searchParams.get('dateRange') ?? '7d';
  const priority = searchParams.get('priority'); // optional filter

  const metrics: RawMetrics = {
    totalAlerts: 247, criticalAlerts: 18, repeatedAlerts: 61, unacknowledgedAlerts: 9,
    avgAcknowledgeMinutes: 9.1, avgResolutionMinutes: 190, slaBreaches: 8, autoClosed: 24,
    totalCameras: 24, onlineCameras: 22, streamDropCount: 33, offlineCriticalCameras: 1,
    edgeServerUptime: 97, openIncidents: 12, unresolvedIncidentCount: 6,
    avgIncidentAgeDays: 3.4, criticalAreaAlerts: 22,
  };

  const scores = calculateAllScores(metrics);
  let recs = generateRecommendations(scores, metrics);

  if (priority) {
    recs = recs.filter((r) => r.priority === priority);
  }

  return NextResponse.json({ dateRange, recommendations: recs });
}
