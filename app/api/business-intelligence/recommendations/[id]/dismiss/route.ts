import '@/lib/school-persistence/init';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const body = await req.json().catch(() => ({}));
  const reason = body.reason ?? '';
  // In production: UPDATE bi_recommendations SET recommendation_status='Dismissed',
  // dismissed_at=NOW(), dismiss_reason=:reason WHERE id = :id
  return NextResponse.json({ ok: true, id, status: 'Dismissed', reason, dismissedAt: new Date().toISOString() });
}
