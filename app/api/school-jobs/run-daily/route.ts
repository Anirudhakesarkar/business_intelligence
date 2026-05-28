import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json } from '@/lib/school-gpt-copilot/json';
import { runDailySchoolIntelligenceJob } from '@/lib/school-jobs/run-daily';

/** Nightly pipeline: evaluate rules → aggregate summaries → calculate scores → GPT summary */
export async function POST(req: NextRequest) {
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const date = req.nextUrl.searchParams.get('date') ?? undefined;
  const seedIfEmpty = req.nextUrl.searchParams.get('seedIfEmpty') !== 'false';
  const includeGpt = req.nextUrl.searchParams.get('includeGpt') !== 'false';
  const result = runDailySchoolIntelligenceJob({ organizationId, date, seedIfEmpty, includeGpt });
  return json(result);
}
