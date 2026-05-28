-- Migration 068: School Intelligence Phase 2 AI Signals

CREATE TYPE school_signal_type AS ENUM (
  'PersonCount', 'PersonTracking', 'AdultPresent', 'TeacherPresent', 'CrowdDensity',
  'Running', 'Loitering', 'ZoneEntry', 'Fall', 'FireSmoke', 'Tamper', 'Offline',
  'TeacherNearBoard', 'TeacherSeatedIdle', 'ClassStartTime', 'ClassEndTime',
  'RoomOccupied', 'RoomEmpty', 'UsageDuration',
  'VehicleQueue', 'ReceptionQueue', 'DispersalDelay',
  'StaffPresentAtGate', 'StaffPresentAtCorridor', 'StaffPresentAtPlayground'
);

CREATE TYPE school_health_status AS ENUM (
  'Online', 'Offline', 'Unstable', 'Tampered', 'Maintenance'
);

CREATE TABLE IF NOT EXISTS school_ai_workers (
  id BIGSERIAL PRIMARY KEY,
  worker_key TEXT NOT NULL UNIQUE,
  worker_type TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  status TEXT NOT NULL DEFAULT 'Healthy',
  capabilities JSONB NOT NULL DEFAULT '[]',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS school_ai_worker_heartbeats (
  id BIGSERIAL PRIMARY KEY,
  worker_id BIGINT NOT NULL REFERENCES school_ai_workers(id) ON DELETE CASCADE,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metrics JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_school_worker_hb_worker ON school_ai_worker_heartbeats (worker_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS school_ai_signal_batches (
  id BIGSERIAL PRIMARY KEY,
  batch_key TEXT NOT NULL UNIQUE,
  camera_id BIGINT NOT NULL,
  worker_id BIGINT REFERENCES school_ai_workers(id) ON DELETE SET NULL,
  model_version TEXT NOT NULL DEFAULT 'v1',
  frame_count INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_school_batches_camera_created ON school_ai_signal_batches (camera_id, started_at DESC);

CREATE TABLE IF NOT EXISTS school_ai_signals (
  id BIGSERIAL PRIMARY KEY,
  camera_id BIGINT NOT NULL,
  batch_id BIGINT REFERENCES school_ai_signal_batches(id) ON DELETE SET NULL,
  signal_type school_signal_type NOT NULL,
  signal_value DOUBLE PRECISION NOT NULL,
  confidence DOUBLE PRECISION,
  observed_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_school_ai_signals_camera_observed ON school_ai_signals (camera_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_school_ai_signals_type_observed ON school_ai_signals (signal_type, observed_at DESC);

CREATE TABLE IF NOT EXISTS school_camera_health_events (
  id BIGSERIAL PRIMARY KEY,
  camera_id BIGINT NOT NULL,
  health_status school_health_status NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_school_health_events_camera_started ON school_camera_health_events (camera_id, started_at DESC);

CREATE TABLE IF NOT EXISTS school_diagnostic_media (
  id BIGSERIAL PRIMARY KEY,
  camera_id BIGINT NOT NULL,
  media_type TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS school_camera_processing_configs (
  camera_id BIGINT PRIMARY KEY,
  sample_rate DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  min_confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  enabled_signals school_signal_type[] NOT NULL DEFAULT '{}',
  zone_polygons JSONB NOT NULL DEFAULT '{}',
  snapshot_enabled BOOLEAN NOT NULL DEFAULT false,
  active_processing BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_signal_retention_policies (
  organization_id BIGINT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  signals_days INT NOT NULL DEFAULT 90,
  batches_days INT NOT NULL DEFAULT 90,
  health_days INT NOT NULL DEFAULT 365,
  heartbeats_days INT NOT NULL DEFAULT 30,
  snapshot_days INT NOT NULL DEFAULT 14,
  clip_days INT NOT NULL DEFAULT 7
);
