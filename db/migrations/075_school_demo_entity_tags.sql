-- Migration 075: Track demo-seeded foundation rows for guarded cleanup

CREATE TABLE IF NOT EXISTS school_demo_entity_tags (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id BIGINT NOT NULL,
  seeded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_school_demo_tags_org_type
  ON school_demo_entity_tags (organization_id, entity_type);
