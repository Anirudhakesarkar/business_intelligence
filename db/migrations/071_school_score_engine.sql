-- Migration 071: School Intelligence Phase 5 Score Engine

CREATE TABLE IF NOT EXISTS school_score_definitions (
  id BIGSERIAL PRIMARY KEY,
  module_key TEXT NOT NULL,
  formula_version TEXT NOT NULL DEFAULT 'v1',
  parameters JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_score_def_module ON school_score_definitions (module_key, formula_version);

CREATE TABLE IF NOT EXISTS school_score_weight_profiles (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_name TEXT NOT NULL DEFAULT 'default',
  effective_from DATE NOT NULL,
  weights JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_weight_profiles_org ON school_score_weight_profiles (organization_id, effective_from DESC);

CREATE TABLE IF NOT EXISTS school_daily_module_scores (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id BIGINT,
  score_date DATE NOT NULL,
  module_key TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  drivers JSONB NOT NULL DEFAULT '[]',
  weight_profile_id BIGINT REFERENCES school_score_weight_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_module_scores_uq
  ON school_daily_module_scores (organization_id, COALESCE(site_id, 0), score_date, module_key);

CREATE TABLE IF NOT EXISTS school_daily_scores (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id BIGINT,
  score_date DATE NOT NULL,
  overall_score NUMERIC(5,2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  weight_profile_id BIGINT REFERENCES school_score_weight_profiles(id),
  module_scores_snapshot JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_scores_uq
  ON school_daily_scores (organization_id, COALESCE(site_id, 0), score_date);
