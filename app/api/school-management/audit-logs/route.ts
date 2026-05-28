import { NextRequest } from 'next/server';
import { json } from '@/lib/school-foundation/json';
import { db } from '@/lib/school-foundation/store';

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 50);
  const rows = db.auditLog().slice(-limit).reverse();
  return json(rows);
}
