#!/usr/bin/env node
/** Apply School Intelligence Postgres migrations (including align patches). */
import { config } from 'dotenv';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: join(root, '.env') });
config({ path: join(root, '.env.local') });

function inferDockerDatabaseUrl() {
  try {
    const raw = execSync("docker inspect vms-postgres --format '{{json .Config.Env}}'", { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const env = JSON.parse(raw);
    const get = (k) => {
      const row = env.find((x) => typeof x === 'string' && x.startsWith(`${k}=`));
      return row ? row.slice(k.length + 1) : '';
    };
    const user = get('POSTGRES_USER') || 'postgres';
    const password = get('POSTGRES_PASSWORD') || 'postgres';
    const database = get('POSTGRES_DB') || 'postgres';
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost:5432/${encodeURIComponent(database)}`;
  } catch {
    return '';
  }
}

if (!process.env.DATABASE_URL) {
  const inferred = inferDockerDatabaseUrl();
  if (inferred) {
    process.env.DATABASE_URL = inferred;
    console.warn('DATABASE_URL not set; using inferred vms-postgres connection.');
  } else {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
}

const { runSchoolMigrations } = await import('../lib/school-db/migrate.ts');
const result = await runSchoolMigrations();
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
