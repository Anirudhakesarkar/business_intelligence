-- Migration 069: School Intelligence Phase 3 Rule Engine

CREATE TABLE IF NOT EXISTS school_intelligence_rules (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  module TEXT NOT NULL DEFAULT 'Core',
  enabled BOOLEAN NOT NULL DEFAULT true,
  severity_default TEXT NOT NULL DEFAULT 'Medium',
  cooldown_seconds INT NOT NULL DEFAULT 300,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_school_rules_org_enabled ON school_intelligence_rules (organization_id, enabled);

CREATE TABLE IF NOT EXISTS school_rule_conditions (
  id BIGSERIAL PRIMARY KEY,
  rule_id BIGINT NOT NULL REFERENCES school_intelligence_rules(id) ON DELETE CASCADE,
  condition_type TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS school_intelligence_events (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id BIGINT REFERENCES school_intelligence_rules(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  module TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open',
  camera_id BIGINT,
  zone_id BIGINT,
  room_id BIGINT,
  class_id BIGINT,
  period_id BIGINT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  confidence DOUBLE PRECISION,
  evidence JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_school_events_org_started ON school_intelligence_events (organization_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_school_events_type_status ON school_intelligence_events (event_type, status);

CREATE TABLE IF NOT EXISTS school_event_acknowledgements (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES school_intelligence_events(id) ON DELETE CASCADE,
  user_id BIGINT,
  action TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
