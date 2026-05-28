import '@/lib/school-persistence/init';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const dateRange = searchParams.get('dateRange') ?? '7d';
  const snapshotType = searchParams.get('type'); // daily | weekly | monthly

  // In production: SELECT * FROM bi_score_snapshots WHERE organization_id=:orgId
  // [AND site_id=:siteId] [AND snapshot_type=:type] ORDER BY snapshot_date DESC LIMIT 30
  return NextResponse.json({
    dateRange, snapshotType,
    snapshots: [
      {
        id: '1', snapshotDate: '2026-05-08', snapshotType: 'daily',
        safetyScore: 86, cameraHealthScore: 94, responseScore: 78, complianceScore: 82,
        riskLevel: 'Medium',
        aiSummary: 'Site performing well. Response time slightly above target during evening hours.',
      },
      {
        id: '2', snapshotDate: '2026-05-01', snapshotType: 'weekly',
        safetyScore: 81, cameraHealthScore: 91, responseScore: 74, complianceScore: 80,
        riskLevel: 'Medium',
        aiSummary: 'Increased alert volume in Main Gate and Parking Area. Camera health stable.',
      },
      {
        id: '3', snapshotDate: '2026-04-30', snapshotType: 'monthly',
        safetyScore: 79, cameraHealthScore: 88, responseScore: 70, complianceScore: 77,
        riskLevel: 'High',
        aiSummary: 'April showed elevated risk. SLA breaches increased by 40%. Review operator scheduling.',
      },
    ],
  });
}
