import { NextRequest } from 'next/server';
import { json } from '@/lib/school-ai-signals/json';
import { listProcessingConfigs } from '@/lib/school-ai-signals/store';

export async function GET(req: NextRequest) {
  const org = Number(req.nextUrl.searchParams.get('organizationId') ?? '1');
  return json(listProcessingConfigs(org));
}
