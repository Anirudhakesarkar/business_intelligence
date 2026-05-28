import { NextRequest } from 'next/server';
import { json } from '@/lib/school-rule-engine/json';
import { listNotifications } from '@/lib/school-rule-engine/store';

export async function GET(req: NextRequest) {
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const unreadOnly = req.nextUrl.searchParams.get('unreadOnly') === 'true';
  return json(listNotifications(organizationId, unreadOnly));
}
