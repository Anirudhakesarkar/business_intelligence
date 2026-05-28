import { json } from '@/lib/school-gpt-copilot/json';
import { runSchoolMigrations } from '@/lib/school-db/migrate';
import { isDbEnabled } from '@/lib/school-db/pool';

export async function POST() {
  if (!isDbEnabled()) {
    return json({ ok: false, error: 'Set DATABASE_URL and SCHOOL_INTELLIGENCE_DB≠0' }, 400);
  }
  const result = await runSchoolMigrations();
  return json(result, result.ok ? 200 : 500);
}
