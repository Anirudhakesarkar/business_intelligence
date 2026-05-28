-- Migration 072: School Intelligence Phase 6 GPT Copilot

CREATE TABLE IF NOT EXISTS school_gpt_summaries (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id BIGINT,
  summary_type TEXT NOT NULL CHECK (summary_type IN ('daily', 'weekly')),
  summary_date DATE NOT NULL,
  week_start DATE,
  content TEXT NOT NULL,
  citations JSONB NOT NULL DEFAULT '[]',
  model TEXT NOT NULL DEFAULT 'demo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gpt_summaries_lookup
  ON school_gpt_summaries (organization_id, summary_type, summary_date DESC);

CREATE TABLE IF NOT EXISTS school_gpt_recommendations (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id BIGINT,
  summary_date DATE NOT NULL,
  priority TEXT NOT NULL,
  module_key TEXT NOT NULL,
  title TEXT NOT NULL,
  rationale TEXT NOT NULL,
  suggested_action TEXT NOT NULL,
  expected_impact TEXT,
  citations JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gpt_recs_date ON school_gpt_recommendations (organization_id, summary_date);

CREATE TABLE IF NOT EXISTS school_gpt_action_tasks (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recommendation_id BIGINT REFERENCES school_gpt_recommendations(id),
  summary_date DATE NOT NULL,
  title TEXT NOT NULL,
  assignee TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'cancelled')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_gpt_chats (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  summary_date DATE NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  citations JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gpt_chats_conv ON school_gpt_chats (organization_id, conversation_id);
