import '@/lib/school-persistence/init';
import { json } from '@/lib/school-gpt-copilot/json';
import { checkSchoolMigrations, isDbEnabled } from '@/lib/school-db/pool';
import { existsSync } from 'fs';
import { join } from 'path';

export async function GET() {
  const migrations = await checkSchoolMigrations();
  const snapshotPath = join(process.cwd(), '.data/school-intelligence.json');
  return json({
    postgres: { ...migrations, configured: isDbEnabled() },
    snapshot: { enabled: process.env.SCHOOL_SNAPSHOT !== '0', exists: existsSync(snapshotPath), path: snapshotPath },
    openai: { configured: Boolean(process.env.OPENAI_API_KEY) },
  });
}
