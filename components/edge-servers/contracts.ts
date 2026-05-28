import type { EdgeHealthLog, EdgeServerRecord } from './types';

function asObj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object') throw new Error('Invalid API payload');
  return v as Record<string, unknown>;
}

function asStr(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asNullableStr(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function asNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asNullableNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseEdgeServer(item: unknown): EdgeServerRecord {
  const o = asObj(item);
  return {
    id: asStr(o.id),
    organization_id: asStr(o.organization_id),
    organization_name: asStr(o.organization_name || ''),
    site_id: asStr(o.site_id),
    site_name: asStr(o.site_name || ''),
    edge_server_name: asStr(o.edge_server_name),
    edge_server_code: asStr(o.edge_server_code),
    server_type: asStr(o.server_type),
    server_status: asStr(o.server_status, 'Draft') as EdgeServerRecord['server_status'],
    assigned_license_id: asNullableStr(o.assigned_license_id),
    max_camera_capacity: asNum(o.max_camera_capacity, 0),
    machine_id: asNullableStr(o.machine_id),
    hostname: asNullableStr(o.hostname),
    local_ip_address: asNullableStr(o.local_ip_address),
    mac_address: asNullableStr(o.mac_address),
    public_ip_address: asNullableStr(o.public_ip_address),
    os_type: asNullableStr(o.os_type),
    os_version: asNullableStr(o.os_version),
    cpu_details: asNullableStr(o.cpu_details),
    ram_gb: asNullableNum(o.ram_gb),
    gpu_details: asNullableStr(o.gpu_details),
    storage_capacity_gb: asNullableNum(o.storage_capacity_gb),
    renderer_software_version: asNullableStr(o.renderer_software_version),
    last_heartbeat_time: asNullableStr(o.last_heartbeat_time),
    last_sync_time: asNullableStr(o.last_sync_time),
    remarks: asNullableStr(o.remarks),
    online_status: asStr(o.online_status, 'offline') as 'online' | 'offline',
    is_active: Boolean(o.is_active),
    is_deleted: Boolean(o.is_deleted),
    created_at: asStr(o.created_at),
    updated_at: asNullableStr(o.updated_at),
  };
}

export function parseEdgeServerList(raw: unknown) {
  const root = asObj(raw);
  const rows = Array.isArray(root.data) ? root.data.map(parseEdgeServer) : [];
  const pg = asObj(root.pagination || {});
  return {
    data: rows,
    pagination: {
      page: asNum(pg.page, 1),
      pageSize: asNum(pg.pageSize, 20),
      total: asNum(pg.total, rows.length),
    },
  };
}

export function parseEdgeServerDetail(raw: unknown): EdgeServerRecord {
  const root = asObj(raw);
  return parseEdgeServer(root.edgeServer ?? root.data ?? root);
}

export function parseEdgeHealthLogs(raw: unknown) {
  const root = asObj(raw);
  const rows = Array.isArray(root.data)
    ? root.data.map((item) => {
        const o = asObj(item);
        const log: EdgeHealthLog = {
          id: asStr(o.id),
          heartbeat_time: asStr(o.heartbeat_time),
          cpu_usage_percent: asNullableNum(o.cpu_usage_percent),
          ram_usage_percent: asNullableNum(o.ram_usage_percent),
          gpu_usage_percent: asNullableNum(o.gpu_usage_percent),
          storage_usage_percent: asNullableNum(o.storage_usage_percent),
          online_camera_count: asNullableNum(o.online_camera_count),
          offline_camera_count: asNullableNum(o.offline_camera_count),
          renderer_status: asNullableStr(o.renderer_status),
          sync_status: asNullableStr(o.sync_status),
        };
        return log;
      })
    : [];
  return rows;
}
