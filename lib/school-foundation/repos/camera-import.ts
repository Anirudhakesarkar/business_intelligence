import type { SchoolCamera } from '../types';
import { orgIdFromPg, resolveOrgIdForPg } from '../../school-db/organization-id';
import { db as memDb } from '../store';
import { listCameras, type ImportCameraRow } from './foundation-cameras';
import { listRooms, listZonesForOrganization } from './foundation-spatial';
import { isDbEnabled, withDbTransaction, type DbQueryFn } from './shared';

export type CameraImportError = { row: number; message: string };

export type CameraImportValidation = {
  valid: boolean;
  errors: CameraImportError[];
  previewCount: number;
  wouldCreate: number;
  wouldSkip: number;
};

export type CameraImportCommitResult = {
  created: number;
  skipped: number;
  errors: CameraImportError[];
  committed: boolean;
  atomicAborted?: boolean;
};

type CameraRow = {
  id: string | number;
  organization_id: string | number;
  zone_id: string | number | null;
  room_id: string | number | null;
  camera_code: string;
  name: string;
  stream_url: string | null;
  purpose: string;
  process_owner: string;
  criticality: string;
  status: string;
  active_from: string | null;
  active_to: string | null;
  metadata: Record<string, unknown> | null;
};

function normCode(code: string) {
  return code.trim().toLowerCase();
}

function rowToInput(organizationId: number, row: ImportCameraRow): Omit<SchoolCamera, 'id'> {
  if (!row.zoneId && !row.roomId) throw new Error('zoneId or roomId is required');
  if ((row.purpose === 'Classroom' || row.purpose === 'Lab') && !row.roomId) {
    throw new Error('Classroom and lab cameras must include roomId');
  }
  return {
    organizationId,
    cameraCode: row.cameraCode.trim(),
    name: row.name.trim(),
    streamUrl: row.streamUrl ?? `rtsp://import/${row.cameraCode.trim()}`,
    purpose: row.purpose,
    processOwner: row.processOwner,
    criticality: row.criticality ?? 'Medium',
    zoneId: row.zoneId,
    roomId: row.roomId,
    status: 'Active',
  };
}

async function insertCameraTx(
  query: DbQueryFn,
  input: Omit<SchoolCamera, 'id'>,
): Promise<SchoolCamera> {
  const dup = await query(`SELECT 1 FROM school_mgmt_cameras WHERE camera_code = $1`, [input.cameraCode]);
  if ((dup?.rowCount ?? 0) > 0) throw new Error('Camera code already exists.');
  const r = await query<CameraRow>(
    `INSERT INTO school_mgmt_cameras (
       organization_id, zone_id, room_id, camera_code, name, stream_url, purpose, process_owner,
       criticality, status, active_from, active_to, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
     RETURNING id, organization_id, zone_id, room_id, camera_code, name, stream_url, purpose, process_owner,
               criticality, status, active_from, active_to, metadata`,
    [
      resolveOrgIdForPg(input.organizationId),
      input.zoneId ?? null,
      input.roomId ?? null,
      input.cameraCode,
      input.name.trim(),
      input.streamUrl?.trim() || `rtsp://pending/${input.cameraCode}`,
      input.purpose,
      input.processOwner,
      input.criticality ?? 'Medium',
      input.status ?? 'Active',
      input.activeFrom ?? null,
      input.activeTo ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  if (!r?.rows[0]) throw new Error('Failed to create camera');
  const row = r.rows[0];
  return {
    id: Number(row.id),
    organizationId: orgIdFromPg(row.organization_id),
    zoneId: row.zone_id != null ? Number(row.zone_id) : undefined,
    roomId: row.room_id != null ? Number(row.room_id) : undefined,
    cameraCode: row.camera_code,
    name: row.name,
    streamUrl: row.stream_url ?? '',
    purpose: row.purpose as SchoolCamera['purpose'],
    processOwner: row.process_owner as SchoolCamera['processOwner'],
    criticality: row.criticality as SchoolCamera['criticality'],
    status: row.status as SchoolCamera['status'],
    activeFrom: row.active_from?.slice(0, 5) ?? undefined,
    activeTo: row.active_to?.slice(0, 5) ?? undefined,
    metadata: row.metadata ?? undefined,
  };
}

export async function validateCameraImport(
  organizationId: number,
  rows: ImportCameraRow[],
): Promise<CameraImportValidation> {
  const existing = await listCameras(organizationId);
  const codes = new Set(existing.map((c) => normCode(c.cameraCode)));
  const errors: CameraImportError[] = [];
  let wouldCreate = 0;
  let wouldSkip = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    if (!row.cameraCode?.trim()) {
      errors.push({ row: rowNum, message: 'cameraCode is required' });
      continue;
    }
    if (!row.name?.trim()) {
      errors.push({ row: rowNum, message: 'name is required' });
      continue;
    }
    if (!row.purpose) {
      errors.push({ row: rowNum, message: 'purpose is required' });
      continue;
    }
    if (!row.processOwner) {
      errors.push({ row: rowNum, message: 'processOwner is required' });
      continue;
    }
    if ((row.purpose === 'Classroom' || row.purpose === 'Lab') && !row.roomId) {
      errors.push({ row: rowNum, message: 'Classroom and lab cameras must include roomId' });
      continue;
    }
    if (!row.zoneId && !row.roomId) {
      errors.push({ row: rowNum, message: 'zoneId or roomId is required' });
      continue;
    }
    if (row.zoneId != null) {
      const zones = isDbEnabled()
        ? await listZonesForOrganization(organizationId)
        : memDb.zones();
      if (!zones.some((z) => z.id === row.zoneId)) {
        errors.push({ row: rowNum, message: 'Invalid zoneId' });
        continue;
      }
    }
    if (row.roomId != null) {
      const rooms = isDbEnabled() ? await listRooms(organizationId) : memDb.rooms();
      if (!rooms.some((r) => r.id === row.roomId)) {
        errors.push({ row: rowNum, message: 'Invalid roomId' });
        continue;
      }
    }
    if (codes.has(normCode(row.cameraCode))) {
      wouldSkip++;
      continue;
    }
    codes.add(normCode(row.cameraCode));
    wouldCreate++;
  }

  return {
    valid: errors.length === 0,
    errors,
    previewCount: rows.length,
    wouldCreate,
    wouldSkip,
  };
}

/** Validate first; on Postgres commit, all new cameras insert in one transaction (rollback on any failure). */
export async function commitCameraImport(
  organizationId: number,
  rows: ImportCameraRow[],
): Promise<CameraImportCommitResult> {
  const preview = await validateCameraImport(organizationId, rows);
  if (!preview.valid) {
    return {
      created: 0,
      skipped: preview.wouldSkip,
      errors: preview.errors,
      committed: false,
      atomicAborted: true,
    };
  }

  const existing = await listCameras(organizationId);
  const codes = new Set(existing.map((c) => normCode(c.cameraCode)));
  const toCreate: { row: ImportCameraRow; rowNum: number }[] = [];
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (codes.has(normCode(row.cameraCode))) {
      skipped++;
      continue;
    }
    codes.add(normCode(row.cameraCode));
    toCreate.push({ row, rowNum: i + 1 });
  }

  if (toCreate.length === 0) {
    return { created: 0, skipped, errors: [], committed: true };
  }

  if (!isDbEnabled()) {
    const { createCamera } = await import('./foundation-cameras');
    for (const { row } of toCreate) {
      await createCamera(rowToInput(organizationId, row));
    }
    return { created: toCreate.length, skipped, errors: [], committed: true };
  }

  await withDbTransaction(async (query) => {
    for (const { row } of toCreate) {
      await insertCameraTx(query, rowToInput(organizationId, row));
    }
  });

  await listCameras(organizationId);
  return { created: toCreate.length, skipped, errors: [], committed: true };
}
