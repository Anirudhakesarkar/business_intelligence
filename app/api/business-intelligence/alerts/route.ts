import '@/lib/school-persistence/init';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const dateRange = searchParams.get('dateRange') ?? '7d';

  return NextResponse.json({
    dateRange,
    metrics: {
      totalAlerts: 247, criticalAlerts: 18, repeatedAlerts: 61,
      unacknowledgedAlerts: 9, avgAcknowledgeMinutes: 7.4,
      avgResolutionMinutes: 148, slaBreaches: 4, autoClosed: 24,
      falsePositiveCount: 12,
    },
    rulePerformance: [
      { rule: 'Intrusion Detection - Night', alerts: 42, type: 'Intrusion', repeated: 28 },
      { rule: 'Crowd Density - Main Gate', alerts: 31, type: 'Crowd', repeated: 19 },
      { rule: 'Vehicle Loitering - Parking', alerts: 18, type: 'Vehicle', repeated: 12 },
      { rule: 'Fire Smoke - Warehouse', alerts: 3, type: 'Fire', repeated: 0 },
    ],
    unresolvedAlerts: [
      { id: 'INC-0041', title: 'After-hours intrusion - Main Gate', age: '4d', severity: 'critical' },
      { id: 'INC-0038', title: 'Repeated crowd alert - Reception', age: '2d', severity: 'high' },
      { id: 'INC-0034', title: 'Vehicle loitering - Parking', age: '1d', severity: 'medium' },
    ],
    alertTrend: null,
  });
}
