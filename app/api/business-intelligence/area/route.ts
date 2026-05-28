import '@/lib/school-persistence/init';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const dateRange = searchParams.get('dateRange') ?? '7d';

  return NextResponse.json({
    dateRange,
    areas: [
      {
        name: 'Main Gate', category: 'Entrance / Exit', businessFunction: 'Safety Monitoring',
        importance: 'Critical', kpiTags: ['Safety Score', 'Unauthorized Access', 'Crowd Level'],
        alertCount: 42, riskLevel: 'High',
        aiInsight: 'Repeated after-hours intrusion alerts and high crowd volume during morning entry.',
      },
      {
        name: 'Parking Area', category: 'External Zone', businessFunction: 'Vehicle Monitoring',
        importance: 'High', kpiTags: ['Vehicle Loitering', 'Vandalism', 'After-Hours Access'],
        alertCount: 18, riskLevel: 'Medium',
        aiInsight: 'Weekend alert frequency is 3× higher than weekdays.',
      },
      {
        name: 'Warehouse', category: 'Storage / Operations', businessFunction: 'Inventory Safety',
        importance: 'High', kpiTags: ['Safety Score', 'Access Compliance', 'Fire Safety'],
        alertCount: 7, riskLevel: 'Low',
      },
    ],
    copilotSummary: 'Main Gate has repeated after-hours intrusion alerts. Parking Area weekend coverage needs review. Warehouse is operating within normal parameters.',
    alertTrend: null,
  });
}
