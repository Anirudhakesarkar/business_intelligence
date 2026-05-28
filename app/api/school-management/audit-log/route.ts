import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json } from '@/lib/school-foundation/json';
import { db } from '@/lib/school-foundation/store';

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 100);
  const entityType = req.nextUrl.searchParams.get('entityType') ?? undefined;
  let rows = db.auditLog();
  if (entityType) rows = rows.filter((r) => r.entityType === entityType);
  return json({ entries: rows.slice(-limit).reverse() });
}
