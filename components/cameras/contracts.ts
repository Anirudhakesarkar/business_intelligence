import type { CameraRecord } from './types';

function asObj(v: unknown): Record<string, unknown> { return (v && typeof v === 'object' ? v : {}) as Record<string, unknown>; }
function asStr(v: unknown, fallback=''): string { return typeof v === 'string' ? v : fallback; }
function asNullableStr(v: unknown): string | null { return typeof v === 'string' ? v : null; }

export function parseCamera(item: unknown): CameraRecord {
  const o = asObj(item);
  return {
    id: asStr(o.id),
    organization_id: asStr(o.organization_id),
    organization_name: asStr(o.organization_name,''),
    site_id: asStr(o.site_id),
    site_name: asStr(o.site_name,''),
    edge_server_id: asStr(o.edge_server_id),
    edge_server_name: asStr(o.edge_server_name,''),
    camera_name: asStr(o.camera_name || o.name),
    camera_code: asStr(o.camera_code),
    camera_status: asStr(o.camera_status,'Draft') as CameraRecord['camera_status'],
    camera_type: asStr(o.camera_type),
    camera_location_area: asStr(o.camera_location_area),
    stream_type: asStr(o.stream_type),
    camera_online: o.camera_online === null || o.camera_online === undefined ? null : Boolean(o.camera_online),
    online_status: asStr(o.online_status,'offline') as 'online'|'offline',
    last_frame_received_time: asNullableStr(o.last_frame_received_time),
    stream_health: asNullableStr(o.stream_health),
    last_snapshot_url: asNullableStr(o.last_snapshot_url),
    remarks: asNullableStr(o.remarks),
  };
}

export function parseCameraList(raw: unknown) {
  const root = asObj(raw);
  const data = Array.isArray(root.data) ? root.data.map(parseCamera) : [];
  const pg = asObj(root.pagination);
  return { data, pagination: { page: Number(pg.page||1), pageSize: Number(pg.pageSize||20), total: Number(pg.total||data.length) } };
}

export function parseCameraDetail(raw: unknown) {
  const root = asObj(raw);
  return parseCamera(root.camera ?? root.data ?? root);
}
