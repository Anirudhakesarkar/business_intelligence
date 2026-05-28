import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json } from '@/lib/school-rule-engine/json';
import { listNotifications, markNotificationRead } from '@/lib/school-rule-engine/notifications';
import type { AuthUserRole } from '@/lib/types';

export async function GET(req: NextRequest) {
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const unreadOnly = req.nextUrl.searchParams.get('unreadOnly') === 'true';
  const role = (req.headers.get('x-school-role') ?? undefined) as AuthUserRole | undefined;
  return json({ organizationId, notifications: listNotifications(organizationId, unreadOnly, role) });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  return json({ notification: markNotificationRead(id) });
}
