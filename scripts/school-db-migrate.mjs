#!/usr/bin/env node
/** Apply School Intelligence Postgres migrations (067–072). */
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: join(root, '.env') });
config({ path: join(root, '.env.local') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const { runSchoolMigrations } = await import('../lib/school-db/migrate.ts');
const result = await runSchoolMigrations();
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
