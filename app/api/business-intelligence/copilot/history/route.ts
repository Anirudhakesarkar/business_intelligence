import '@/lib/school-persistence/init';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const organizationId = searchParams.get('organizationId');
  const siteId = searchParams.get('siteId');
  const limit = parseInt(searchParams.get('limit') ?? '20');

  // In production: SELECT * FROM bi_copilot_chats WHERE organization_id=:orgId
  // [AND site_id=:siteId] ORDER BY created_at DESC LIMIT :limit
  return NextResponse.json({
    organizationId, siteId, limit,
    history: [],
  });
}
