import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-rule-engine/json';
import { listNotifications } from '@/lib/school-rule-engine/notifications';

export async function POST(req: NextRequest) {
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const body = await req.json().catch(() => ({}));
  const url = (body.webhookUrl as string) ?? process.env.SCHOOL_WEBHOOK_URL;
  if (!url) return err('webhookUrl or SCHOOL_WEBHOOK_URL required');
  const notifications = listNotifications(organizationId, true).slice(0, 10);
  if (process.env.SCHOOL_WEBHOOK_DRY_RUN === '1') return json({ ok: true, dryRun: true, wouldSend: notifications.length, url });
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ organizationId, notifications }) });
  return json({ ok: res.ok, status: res.status, sent: notifications.length });
}
