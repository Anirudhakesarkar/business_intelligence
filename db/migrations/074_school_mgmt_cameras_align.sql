-- Migration 074: align school_mgmt_cameras with runtime expectations.
-- Safe/idempotent; only additive corrections.

ALTER TABLE school_mgmt_cameras
  ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS zone_id BIGINT REFERENCES school_zones(id),
  ADD COLUMN IF NOT EXISTS room_id BIGINT REFERENCES school_rooms(id),
  ADD COLUMN IF NOT EXISTS camera_code TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS stream_url TEXT,
  ADD COLUMN IF NOT EXISTS purpose TEXT,
  ADD COLUMN IF NOT EXISTS process_owner TEXT,
  ADD COLUMN IF NOT EXISTS criticality TEXT DEFAULT 'Medium',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS active_from TIME,
  ADD COLUMN IF NOT EXISTS active_to TIME,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE school_mgmt_cameras SET metadata = '{}'::jsonb WHERE metadata IS NULL;
UPDATE school_mgmt_cameras SET status = 'Active' WHERE status IS NULL;
UPDATE school_mgmt_cameras SET criticality = 'Medium' WHERE criticality IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'school_mgmt_cameras_camera_code_key'
  ) THEN
    ALTER TABLE school_mgmt_cameras
      ADD CONSTRAINT school_mgmt_cameras_camera_code_key UNIQUE (camera_code);
  END IF;
EXCEPTION
  WHEN unique_violation THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_school_cameras_org_status
  ON school_mgmt_cameras (organization_id, status);
