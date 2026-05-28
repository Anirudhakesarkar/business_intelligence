export const EDGE_SERVER_TYPES = [
  'AI Edge Server',
  'Renderer Server',
  'Recording Server',
  'Hybrid Server',
  'Testing Server',
] as const;

export const EDGE_SERVER_STATUSES = [
  'Draft',
  'Pending Activation',
  'Active',
  'Offline',
  'Suspended',
  'Decommissioned',
] as const;

export type EdgeServerStatus = (typeof EDGE_SERVER_STATUSES)[number];

export type EdgeServerRecord = {
  id: string;
  organization_id: string;
  organization_name?: string;
  site_id: string;
  site_name?: string;
  edge_server_name: string;
  edge_server_code: string;
  server_type: string;
  server_status: EdgeServerStatus;
  assigned_license_id: string | null;
  max_camera_capacity: number;
  machine_id: string | null;
  hostname: string | null;
  local_ip_address: string | null;
  mac_address: string | null;
  public_ip_address: string | null;
  os_type: string | null;
  os_version: string | null;
  cpu_details: string | null;
  ram_gb: number | null;
  gpu_details: string | null;
  storage_capacity_gb: number | null;
  renderer_software_version: string | null;
  last_heartbeat_time: string | null;
  last_sync_time: string | null;
  remarks: string | null;
  online_status?: 'online' | 'offline';
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string | null;
};

export type EdgeHealthLog = {
  id: string;
  heartbeat_time: string;
  cpu_usage_percent: number | null;
  ram_usage_percent: number | null;
  gpu_usage_percent: number | null;
  storage_usage_percent: number | null;
  online_camera_count: number | null;
  offline_camera_count: number | null;
  renderer_status: string | null;
  sync_status: string | null;
};
