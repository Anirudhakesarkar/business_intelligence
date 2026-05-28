import type { Criticality, SchoolCamera } from '../types';
import { orgIdFromPg, resolveOrgIdForPg } from '../../school-db/organization-id';
import { db as memDb, logAudit, _ensureNextIdAbove } from '../store';
import { dbQuery, isDbEnabled, num, requirePool } from './shared';

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

function timeToStr(t: string | null): string | undefined {
  if (!t) return undefined;
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function cameraFromRow(r: CameraRow): SchoolCamera {
  return {
    id: num(r.id),
    organizationId: orgIdFromPg(r.organization_id),
    zoneId: r.zone_id != null ? num(r.zone_id) : undefined,
    roomId: r.room_id != null ? num(r.room_id) : undefined,
    cameraCode: r.camera_code,
    name: r.name,
    streamUrl: r.stream_url ?? '',
    purpose: r.purpose as SchoolCamera['purpose'],
    processOwner: r.process_owner as SchoolCamera['processOwner'],
    criticality: r.criticality as Criticality,
    status: r.status as SchoolCamera['status'],
    activeFrom: timeToStr(r.active_from),
    activeTo: timeToStr(r.active_to),
    metadata: r.metadata ?? undefined,
  };
}

function mirrorCamera(row: SchoolCamera) {
  const arr = memDb.cameras();
  if (!arr.some((c) => c.id === row.id)) arr.push(row);
  _ensureNextIdAbove(row.id);
}

function validateCameraInput(input: Partial<SchoolCamera>) {
  if (!input.zoneId && !input.roomId) throw new Error('Camera must be mapped to at least a zone or room.');
  if ((input.purpose === 'Classroom' || input.purpose === 'Lab') && !input.roomId) {
    throw new Error('Classroom and lab cameras must be mapped to a room.');
  }
  if (input.activeFrom && input.activeTo && input.activeTo <= input.activeFrom) {
    throw new Error('Camera active end time must be after start time.');
  }
}

export async function listCameras(organizationId?: number | string): Promise<SchoolCamera[]> {
  if (!isDbEnabled()) {
    if (organizationId == null) return [...memDb.cameras()];
    const org = Number(organizationId);
    return memDb.cameras().filter((c) => c.organizationId === org);
  }
  requirePool();
  const sql = organizationId
    ? `SELECT id, organization_id, zone_id, room_id, camera_code, name, stream_url, purpose, process_owner,
              criticality, status, active_from, active_to, metadata
       FROM school_mgmt_cameras WHERE organization_id = $1 ORDER BY id`
    : `SELECT id, organization_id, zone_id, room_id, camera_code, name, stream_url, purpose, process_owner,
              criticality, status, active_from, active_to, metadata
       FROM school_mgmt_cameras ORDER BY id`;
  const params = organizationId ? [resolveOrgIdForPg(organizationId)] : [];
  const r = await dbQuery<CameraRow>(sql, params);
  const rows = (r?.rows ?? []).map(cameraFromRow);
  for (const row of rows) mirrorCamera(row);
  return rows;
}

export async function createCamera(input: Omit<SchoolCamera, 'id'>): Promise<SchoolCamera> {
  requirePool();
  validateCameraInput(input);
  const dup = await dbQuery(`SELECT 1 FROM school_mgmt_cameras WHERE camera_code = $1`, [input.cameraCode]);
  if ((dup?.rowCount ?? 0) > 0) throw new Error('Camera code already exists.');
  const r = await dbQuery<CameraRow>(
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
      input.streamUrl ?? null,
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
  const row = cameraFromRow(r.rows[0]);
  mirrorCamera(row);
  logAudit('create', 'camera', row.id, row);
  return row;
}

export async function patchCamera(id: number, patch: Partial<SchoolCamera>): Promise<SchoolCamera> {
  requirePool();
  const existing = memDb.cameras().find((c) => c.id === id);
  if (!existing) {
    await listCameras();
    if (!memDb.cameras().find((c) => c.id === id)) throw new Error('Camera not found');
  }
  const merged = { ...memDb.cameras().find((c) => c.id === id)!, ...patch };
  validateCameraInput(merged);
  const r = await dbQuery<CameraRow>(
    `UPDATE school_mgmt_cameras SET
       zone_id = $1, room_id = $2, name = $3, stream_url = $4, purpose = $5, process_owner = $6,
       criticality = $7, status = $8, active_from = $9, active_to = $10, metadata = $11::jsonb
     WHERE id = $12
     RETURNING id, organization_id, zone_id, room_id, camera_code, name, stream_url, purpose, process_owner,
               criticality, status, active_from, active_to, metadata`,
    [
      merged.zoneId ?? null,
      merged.roomId ?? null,
      merged.name,
      merged.streamUrl ?? null,
      merged.purpose,
      merged.processOwner,
      merged.criticality,
      merged.status,
      merged.activeFrom ?? null,
      merged.activeTo ?? null,
      JSON.stringify(merged.metadata ?? {}),
      id,
    ],
  );
  if (!r?.rows[0]) throw new Error('Camera not found');
  const row = cameraFromRow(r.rows[0]);
  const arr = memDb.cameras();
  const i = arr.findIndex((c) => c.id === id);
  if (i >= 0) arr[i] = row;
  logAudit('update', 'camera', id, row);
  return row;
}

export type ImportCameraRow = {
  cameraCode: string;
  name: string;
  purpose: SchoolCamera['purpose'];
  processOwner: SchoolCamera['processOwner'];
  criticality?: Criticality;
  zoneId?: number;
  roomId?: number;
  streamUrl?: string;
};

export async function importCameras(organizationId: number | string, rows: ImportCameraRow[]) {
  const orgId = typeof organizationId === 'string' ? Number(organizationId) : organizationId;
  if (!Number.isFinite(orgId)) throw new Error('Invalid organizationId');
  const created: SchoolCamera[] = [];
  const errors: { row: number; message: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    try {
      created.push(
        await createCamera({
          organizationId: orgId,
          cameraCode: rows[i].cameraCode,
          name: rows[i].name,
          streamUrl: rows[i].streamUrl ?? `rtsp://demo/${rows[i].cameraCode}`,
          purpose: rows[i].purpose,
          processOwner: rows[i].processOwner,
          criticality: rows[i].criticality ?? 'Medium',
          zoneId: rows[i].zoneId,
          roomId: rows[i].roomId,
          status: 'Active',
        }),
      );
    } catch (e) {
      errors.push({ row: i + 1, message: (e as Error).message });
    }
  }
  return { created: created.length, errors };
}

export async function hydrateCamerasFromPg(): Promise<{ hydrated: number }> {
  const rows = await listCameras();
  return { hydrated: rows.length };
}
