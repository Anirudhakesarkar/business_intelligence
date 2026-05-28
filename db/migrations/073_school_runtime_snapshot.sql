-- Migration 073: Full runtime snapshot for School Intelligence (foundation through GPT)

CREATE TABLE IF NOT EXISTS school_runtime_snapshots (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payload JSONB NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_school_runtime_snap_org ON school_runtime_snapshots (organization_id, saved_at DESC);
