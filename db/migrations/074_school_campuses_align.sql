-- Migration 074: align foundation naming with campus-based schema.
-- Safe/idempotent: keeps existing school_sites/site_id paths working while
-- introducing school_campuses/campus_id compatibility used by some DBs.

DO $$
BEGIN
  -- Compatibility table used by newer DB snapshots.
  CREATE TABLE IF NOT EXISTS school_campuses (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    campus_name TEXT NOT NULL,
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- If a prior schema created "name" instead of "campus_name", keep both compatible.
ALTER TABLE school_campuses ADD COLUMN IF NOT EXISTS name TEXT;
UPDATE school_campuses SET name = campus_name WHERE name IS NULL;
UPDATE school_campuses SET campus_name = name WHERE campus_name IS NULL;

-- Seed campuses from legacy school_sites only when that table exists.
DO $$
BEGIN
  IF to_regclass('public.school_sites') IS NOT NULL THEN
    INSERT INTO school_campuses (id, organization_id, campus_name, name, address, is_active, created_at)
    SELECT s.id, s.organization_id, s.name, s.name, s.address, s.is_active, COALESCE(s.created_at, NOW())
    FROM school_sites s
    LEFT JOIN school_campuses c ON c.id = s.id
    WHERE c.id IS NULL;
  END IF;
END $$;

-- Keep sequence above copied IDs.
SELECT setval(
  pg_get_serial_sequence('school_campuses', 'id'),
  COALESCE((SELECT MAX(id) FROM school_campuses), 1),
  true
);

-- Add campus_id path on buildings for newer schema compatibility.
ALTER TABLE school_buildings ADD COLUMN IF NOT EXISTS campus_id BIGINT;
UPDATE school_buildings
SET campus_id = site_id
WHERE campus_id IS NULL AND site_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'school_buildings_campus_id_fkey'
  ) THEN
    ALTER TABLE school_buildings
      ADD CONSTRAINT school_buildings_campus_id_fkey
      FOREIGN KEY (campus_id) REFERENCES school_campuses(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_school_campuses_org ON school_campuses (organization_id);
CREATE INDEX IF NOT EXISTS idx_school_buildings_campus_id ON school_buildings (campus_id);
