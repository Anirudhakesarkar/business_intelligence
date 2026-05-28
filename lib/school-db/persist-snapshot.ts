import { dbQuery, isDbEnabled } from './pool';
import type { exportSnapshot } from '../school-persistence/snapshot';

export async function persistRuntimeSnapshot(organizationId: number, payload: ReturnType<typeof import('../school-persistence/snapshot').exportSnapshot>) {
  if (!isDbEnabled()) return;
  const date = new Date().toISOString().slice(0, 10);
  await dbQuery(
    `INSERT INTO school_runtime_snapshots (organization_id, snapshot_date, payload, saved_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (organization_id, snapshot_date)
     DO UPDATE SET payload = EXCLUDED.payload, saved_at = NOW()`,
    [organizationId, date, JSON.stringify(payload)]
  );
}

export async function loadRuntimeSnapshot(organizationId: number, date?: string) {
  if (!isDbEnabled()) return null;
  const snapshotDate = date ?? new Date().toISOString().slice(0, 10);
  const r = await dbQuery<{ payload: unknown }>(
    `SELECT payload FROM school_runtime_snapshots
     WHERE organization_id = $1 AND snapshot_date = $2
     ORDER BY saved_at DESC LIMIT 1`,
    [organizationId, snapshotDate]
  );
  const row = r?.rows[0];
  if (!row) return null;
  return row.payload as ReturnType<typeof import('../school-persistence/snapshot').exportSnapshot>;
}
