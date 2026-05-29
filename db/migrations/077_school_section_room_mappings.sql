-- Migration 077: Persist section-room mappings to PostgreSQL.
-- Previously these were in-memory only (lib/school-foundation/store.ts).
-- This migration makes them durable across restarts.

CREATE TABLE IF NOT EXISTS school_section_room_mappings (
  id            BIGSERIAL PRIMARY KEY,
  section_id    BIGINT NOT NULL REFERENCES school_sections(id) ON DELETE CASCADE,
  room_id       BIGINT NOT NULL REFERENCES school_rooms(id) ON DELETE CASCADE,
  is_primary    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (section_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_section_room_mappings_section ON school_section_room_mappings (section_id);
CREATE INDEX IF NOT EXISTS idx_section_room_mappings_room    ON school_section_room_mappings (room_id);

-- Also ensure school_timetable_entries has teacher_id FK (was in 067 but may be missing on older DBs)
ALTER TABLE school_timetable_entries
  ADD COLUMN IF NOT EXISTS teacher_id BIGINT REFERENCES school_teachers(id);

-- Ensure is_active flag exists on timetable entries (used to soft-delete)
ALTER TABLE school_timetable_entries
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Ensure staff_duty_rosters has is_active for soft-delete parity with timetable
ALTER TABLE school_staff_duty_rosters
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
