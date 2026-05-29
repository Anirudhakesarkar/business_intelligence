import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json } from '@/lib/school-gpt-copilot/json';
import { runDailySchoolIntelligenceJob } from '@/lib/school-jobs/run-daily';

/** E2E: Phase 1 → 6 via daily job runner (evaluate → aggregate → scores → GPT). */
export async function POST(req: NextRequest) {
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const date = req.nextUrl.searchParams.get('date') ?? undefined;
  const result = await runDailySchoolIntelligenceJob({
    organizationId,
    date,
    includeGpt: true,
  });
  return json({
    message: 'School Intelligence pipeline run (Phases 3–6). Populate foundation data via School Management first.',
    ...result,
  });
}
