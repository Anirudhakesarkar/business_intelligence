// Align with server API responses

/** Roles aligned with backend (roles table + user_roles) */
export type AuthUserRole = 'superadmin' | 'org_admin' | 'site_admin' | 'operator' | 'site_viewer';

export type AuthUser = {
  id: string;
  email: string;
  display_name: string;
  role: AuthUserRole;
  /** Present when the session is scoped to an organization (e.g. org_admin). */
  org_id?: string;
  site_ids: string[];
};

export type Config = {
  serverUrl: string;
  siteId: string;
  apiKey: string;
  /** Access token (sessionStorage in browser â€” not persisted across tabs). */
  token?: string;
  /**
   * @deprecated No longer stored client-side. Refresh tokens live in HttpOnly cookies (`/api/*`) via BFF routes.
   */
  refresh_token?: string;
  user?: AuthUser;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  is_active: boolean;
  max_sites: number;
  max_devices: number;
  created_at: string;
  /** From API when available */
  sites_used?: number;
  devices_used?: number;
  users_used?: number;
};

export type Site = {
  site_id: string;
  name: string;
  org_id?: string;
  timezone?: string | null;
  address?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  locality?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  last_seen_at: number | null;
  app_version?: string | null;
  device_id?: string | null;
  status: 'ONLINE' | 'OFFLINE';
  device_count?: number;
  online_device_count?: number;
  /** Present on admin Sites list */
  api_key_expires_at?: string | null;
  /** Present on admin Sites list */
  api_key_issued_at?: string | null;
  statusSummary: {
    OK: number;
    WARN: number;
    CRITICAL: number;
    OFFLINE: number;
  };
};

export type Camera = {
  camera_id: string;
  cloud_camera_id?: string;
  site_id?: string;
  name: string;
  location?: string | null;
  description?: string | null;
  model?: string | null;
  ip_address?: string | null;
  status?: string;
  last_data_at?: number | null;
  kbps?: number | null;
  restarts?: number;
  resolved_mode?: string | null;
  codec?: string | null;
  profile?: string | null;
  reachability_ok?: boolean | null;
  reachability_rtt_ms?: number | null;
  reachability_checked_at?: number | null;
  ingest_monitoring_enabled?: boolean | null;
  ingest_health?: string | null;
  ingest_state?: string | null;
  ingest_last_frame_at?: number | null;
  ingest_last_error?: string | null;
  ingest_restart_count?: number | null;
  updated_at?: number;
  is_active?: boolean;
};

export type EdgeDevice = {
  device_id: string;
  site_id: string;
  device_name: string;
  device_role: string;
  app_version?: string | null;
  last_seen_at: number | null;
  status: string;
  created_at: number;
  updated_at: number;
};

export type AIEvent = {
  event_id: string;
  site_id: string;
  camera_id: string;
  camera_name?: string | null;
  edge_device_id?: string | null;
  event_type: string;
  severity: 'info' | 'warning' | 'critical';
  status: string;
  start_ts: string;
  end_ts?: string | null;
  summary?: string | null;
  snapshot_url?: string | null;
  clip_url?: string | null;
  incident_id?: string | null;
  incident_status?: string | null;
  evidence?: unknown;
  created_at?: number;
};

export type Incident = {
  incident_id: string;
  site_id: string;
  event_id: string;
  title: string;
  severity: string;
  status: 'open' | 'acknowledged' | 'in_progress' | 'resolved';
  assigned_to?: string | null;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  sla_due_at?: string | null;
  notes?: string | null;
  created_at?: number;
  updated_at?: number;
}

export type ExportJob = {
  export_id: string;
  camera_id?: string;
  site_id?: string;
  start_ts: number;
  end_ts: number;
  status: string;
  requested_by?: string;
  download_url?: string | null;
  created_at?: number;
};

/** AI rule row synced from edge (read-only in dashboard). */
export type CloudAIRule = {
  site_id: string;
  rule_id: string;
  name: string;
  event_type: string;
  enabled: boolean;
  conditions_json: Record<string, unknown> | null;
  cooldown_seconds: number;
  schedule_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type CloudAIRuleBinding = {
  site_id: string;
  rule_id: string;
  camera_id: string;
  deployment_id?: string | null;
  priority: number;
  created_at: string;
};

