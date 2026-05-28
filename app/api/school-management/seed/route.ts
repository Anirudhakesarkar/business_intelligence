import '@/lib/school-persistence/init';
import { json, err } from '@/lib/school-foundation/json';
import { seedDemoSchool } from '@/lib/school-foundation/seed';
import { isSchoolDemoUiEnabled } from '@/lib/school-foundation/runtime-mode';

export async function POST() {
  if (!isSchoolDemoUiEnabled()) {
    return err('Demo seed is disabled in production mode (SCHOOL_PRODUCTION_MODE=1 or SCHOOL_SNAPSHOT=0).', 403);
  }
  try {
    const result = await seedDemoSchool(1);
    return json({ ok: true, tagged: true, ...result });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
}
