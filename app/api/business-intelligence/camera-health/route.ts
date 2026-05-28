import '@/lib/school-persistence/init';
import { NextRequest, NextResponse } from 'next/server';
import { calculateCameraHealthScore } from '@/lib/business-intelligence/score-calculator';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const dateRange = searchParams.get('dateRange') ?? '7d';

  const totalCameras = 24;
  const onlineCameras = 22;
  const streamDropCount = 33;
  const offlineCritical = 1;
  const edgeUptime = 97;

  const healthScore = calculateCameraHealthScore({
    totalCameras, onlineCameras, streamDropCount, offlineCriticalCameras: offlineCritical,
    edgeServerUptime: edgeUptime,
    totalAlerts: 0, criticalAlerts: 0, repeatedAlerts: 0, unacknowledgedAlerts: 0,
    avgAcknowledgeMinutes: 0, avgResolutionMinutes: 0, slaBreaches: 0, autoClosed: 0,
    openIncidents: 0, unresolvedIncidentCount: 0, avgIncidentAgeDays: 0, criticalAreaAlerts: 0,
  });

  return NextResponse.json({
    dateRange,
    healthScore,
    cameraSummary: {
      total: totalCameras, online: onlineCameras,
      streamDrops: streamDropCount, offlineCritical,
      issues: [
        { name: 'CAM-HAN-014', issue: 'Frequent stream drops', count: 28 },
        { name: 'CAM-HAN-007', issue: 'Offline — no heartbeat', count: 1 },
      ],
    },
    cameras: [
      { id: 'CAM-HAN-014', name: 'Parking Cam 4', area: 'Parking Area', status: 'online', streamDrops: 28, health: 'Degraded' },
      { id: 'CAM-HAN-007', name: 'Main Gate Left', area: 'Main Gate', status: 'offline', streamDrops: 0, health: 'Offline' },
      { id: 'CAM-HAN-002', name: 'Warehouse Entry', area: 'Warehouse', status: 'online', streamDrops: 4, health: 'Good' },
      { id: 'CAM-HAN-019', name: 'Reception Cam', area: 'Reception', status: 'online', streamDrops: 1, health: 'Good' },
    ],
    edgeNodes: [
      { id: 'EDGE-HAN-01', name: 'Hannur Edge Node 1', status: 'online', uptime: 99.8, cameras: 12 },
      { id: 'EDGE-HAN-02', name: 'Hannur Edge Node 2', status: 'degraded', uptime: 94.2, cameras: 12 },
    ],
  });
}
