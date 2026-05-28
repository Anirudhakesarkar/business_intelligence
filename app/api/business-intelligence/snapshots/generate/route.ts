import '@/lib/school-persistence/init';
import { NextRequest, NextResponse } from 'next/server';
import { calculateAllScores, type RawMetrics } from '@/lib/business-intelligence/score-calculator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { organizationId = 1, siteId, snapshotType = 'daily' } = body;

    // In production: fetch live metrics from DB, calculate scores, then INSERT INTO bi_score_snapshots
    const metrics: RawMetrics = {
      totalAlerts: 247, criticalAlerts: 18, repeatedAlerts: 61, unacknowledgedAlerts: 9,
      avgAcknowledgeMinutes: 7.4, avgResolutionMinutes: 148, slaBreaches: 4, autoClosed: 24,
      totalCameras: 24, onlineCameras: 22, streamDropCount: 8, offlineCriticalCameras: 1,
      edgeServerUptime: 98, openIncidents: 12, unresolvedIncidentCount: 4,
      avgIncidentAgeDays: 2.1, criticalAreaAlerts: 18,
    };

    const scores = calculateAllScores(metrics);
    const snapshotDate = new Date().toISOString().slice(0, 10);

    const snapshot = {
      id: Date.now().toString(),
      organizationId, siteId, snapshotType, snapshotDate,
      ...scores,
      aiSummary: `Snapshot generated on ${snapshotDate}. Safety: ${scores.safetyScore}/100, Camera Health: ${scores.cameraHealthScore}/100, Response: ${scores.responseScore}/100, Risk: ${scores.riskLevel}.`,
    };

    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    console.error('Snapshot generation error:', err);
    return NextResponse.json({ error: 'Failed to generate snapshot' }, { status: 500 });
  }
}
