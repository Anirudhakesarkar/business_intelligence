#!/usr/bin/env node
import { config } from 'dotenv';
import pg from 'pg';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: join(root, '.env.local') });

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveOrgId(raw) {
  const s = String(raw).trim();
  if (UUID_RE.test(s)) return s;
  const envUuid = process.env.SCHOOL_ORGANIZATION_UUID?.trim();
  if (envUuid && UUID_RE.test(envUuid) && (s === '1' || raw === 1)) return envUuid;
  return s;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const orgId = resolveOrgId(1);
const ins = await pool.query(
  `INSERT INTO school_sites (organization_id, name, address, is_active)
   VALUES ($1, $2, $3, TRUE)
   RETURNING id, organization_id, name, address`,
  [orgId, 'Main Campus PG Test', '12 Campus Rd'],
);
console.log('INSERT:', ins.rows[0]);
const list = await pool.query(
  `SELECT id, organization_id, name FROM school_sites WHERE organization_id = $1 ORDER BY id`,
  [orgId],
);
console.log('LIST:', list.rows);
await pool.end();
