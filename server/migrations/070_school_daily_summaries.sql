-- Migration 070: School Intelligence — Phase 4 Daily Summaries
-- Depends on organizations (067), school_intelligence_events (069).

CREATE TABLE IF NOT EXISTS school_teacher_daily_intelligence (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id BIGINT,
  summary_date DATE NOT NULL,
  teacher_id BIGINT,
  metrics JSONB NOT NULL DEFAULT '{}',
  facts JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_daily_uq
  ON school_teacher_daily_intelligence (organization_id, COALESCE(site_id, 0), summary_date, COALESCE(teacher_id, 0));
CREATE INDEX IF NOT EXISTS idx_teacher_daily_date ON school_teacher_daily_intelligence (organization_id, summary_date);

CREATE TABLE IF NOT EXISTS school_classroom_daily_intelligence (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id BIGINT,
  summary_date DATE NOT NULL,
  room_id BIGINT,
  class_id BIGINT,
  section_id BIGINT,
  metrics JSONB NOT NULL DEFAULT '{}',
  facts JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_classroom_daily_uq
  ON school_classroom_daily_intelligence (organization_id, COALESCE(site_id, 0), summary_date, COALESCE(room_id, 0), COALESCE(class_id, 0));
CREATE INDEX IF NOT EXISTS idx_classroom_daily_date ON school_classroom_daily_intelligence (organization_id, summary_date);

CREATE TABLE IF NOT EXISTS school_student_occupancy_daily (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id BIGINT,
  summary_date DATE NOT NULL,
  room_id BIGINT,
  zone_id BIGINT,
  metrics JSONB NOT NULL DEFAULT '{}',
  facts JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_occupancy_daily_uq
  ON school_student_occupancy_daily (organization_id, COALESCE(site_id, 0), summary_date, COALESCE(room_id, 0));
CREATE INDEX IF NOT EXISTS idx_occupancy_daily_date ON school_student_occupancy_daily (organization_id, summary_date);

CREATE TABLE IF NOT EXISTS school_process_daily_intelligence (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id BIGINT,
  summary_date DATE NOT NULL,
  time_window TEXT,
  metrics JSONB NOT NULL DEFAULT '{}',
  facts JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_process_daily_uq
  ON school_process_daily_intelligence (organization_id, COALESCE(site_id, 0), summary_date, COALESCE(time_window, ''));
CREATE INDEX IF NOT EXISTS idx_process_daily_date ON school_process_daily_intelligence (organization_id, summary_date);

CREATE TABLE IF NOT EXISTS school_staff_deployment_daily (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id BIGINT,
  summary_date DATE NOT NULL,
  zone_id BIGINT,
  duty_role TEXT,
  metrics JSONB NOT NULL DEFAULT '{}',
  facts JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_daily_uq
  ON school_staff_deployment_daily (organization_id, COALESCE(site_id, 0), summary_date, COALESCE(zone_id, 0), COALESCE(duty_role, ''));
CREATE INDEX IF NOT EXISTS idx_staff_daily_date ON school_staff_deployment_daily (organization_id, summary_date);

CREATE TABLE IF NOT EXISTS school_space_utilization_daily (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id BIGINT,
  summary_date DATE NOT NULL,
  room_id BIGINT,
  metrics JSONB NOT NULL DEFAULT '{}',
  facts JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_space_daily_uq
  ON school_space_utilization_daily (organization_id, COALESCE(site_id, 0), summary_date, COALESCE(room_id, 0));
CREATE INDEX IF NOT EXISTS idx_space_daily_date ON school_space_utilization_daily (organization_id, summary_date);

CREATE TABLE IF NOT EXISTS school_discipline_daily_intelligence (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id BIGINT,
  summary_date DATE NOT NULL,
  zone_id BIGINT,
  metrics JSONB NOT NULL DEFAULT '{}',
  facts JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_discipline_daily_uq
  ON school_discipline_daily_intelligence (organization_id, COALESCE(site_id, 0), summary_date, COALESCE(zone_id, 0));
CREATE INDEX IF NOT EXISTS idx_discipline_daily_date ON school_discipline_daily_intelligence (organization_id, summary_date);

CREATE TABLE IF NOT EXISTS school_parent_experience_daily (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id BIGINT,
  summary_date DATE NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  facts JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_daily_uq
  ON school_parent_experience_daily (organization_id, COALESCE(site_id, 0), summary_date);
CREATE INDEX IF NOT EXISTS idx_parent_daily_date ON school_parent_experience_daily (organization_id, summary_date);

CREATE TABLE IF NOT EXISTS school_compliance_daily_intelligence (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id BIGINT,
  summary_date DATE NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  facts JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_daily_uq
  ON school_compliance_daily_intelligence (organization_id, COALESCE(site_id, 0), summary_date);
CREATE INDEX IF NOT EXISTS idx_compliance_daily_date ON school_compliance_daily_intelligence (organization_id, summary_date);

-- Phase 5 score inputs only (NOT weighted overall score)
CREATE TABLE IF NOT EXISTS school_daily_score_inputs (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id BIGINT,
  summary_date DATE NOT NULL,
  inputs_json JSONB NOT NULL DEFAULT '{}',
  facts JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_score_inputs_uq
  ON school_daily_score_inputs (organization_id, COALESCE(site_id, 0), summary_date);
CREATE INDEX IF NOT EXISTS idx_score_inputs_date ON school_daily_score_inputs (organization_id, summary_date);
