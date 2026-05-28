-- Migration 067: School Intelligence Phase 1 Foundation

CREATE TABLE IF NOT EXISTS school_sites (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_buildings (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES school_sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS school_floors (
  id BIGSERIAL PRIMARY KEY,
  building_id BIGINT NOT NULL REFERENCES school_buildings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level_no INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS school_zones (
  id BIGSERIAL PRIMARY KEY,
  floor_id BIGINT REFERENCES school_floors(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  zone_type TEXT NOT NULL DEFAULT 'General',
  is_risk_zone BOOLEAN NOT NULL DEFAULT FALSE,
  risk_category TEXT,
  capacity INT
);

CREATE TABLE IF NOT EXISTS school_rooms (
  id BIGSERIAL PRIMARY KEY,
  zone_id BIGINT REFERENCES school_zones(id) ON DELETE SET NULL,
  room_code TEXT NOT NULL,
  room_name TEXT NOT NULL,
  room_type TEXT NOT NULL DEFAULT 'Classroom',
  capacity INT NOT NULL CHECK (capacity > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS school_mgmt_cameras (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  zone_id BIGINT REFERENCES school_zones(id),
  room_id BIGINT REFERENCES school_rooms(id),
  camera_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  stream_url TEXT,
  purpose TEXT NOT NULL,
  process_owner TEXT NOT NULL,
  criticality TEXT NOT NULL DEFAULT 'Medium',
  status TEXT NOT NULL DEFAULT 'Active',
  active_from TIME,
  active_to TIME,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_school_cameras_org_status ON school_mgmt_cameras (organization_id, status);

CREATE TABLE IF NOT EXISTS school_classes (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS school_sections (
  id BIGSERIAL PRIMARY KEY,
  class_id BIGINT NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  expected_student_count INT NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS school_subjects (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS school_teachers (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_code TEXT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS school_staff_members (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_code TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS school_calendars (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  calendar_date DATE NOT NULL,
  day_type TEXT NOT NULL,
  label TEXT,
  timing_override JSONB,
  UNIQUE (organization_id, calendar_date)
);
CREATE INDEX IF NOT EXISTS idx_school_calendar_org_date ON school_calendars (organization_id, calendar_date);

CREATE TABLE IF NOT EXISTS school_time_windows (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  window_type TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS school_timetable_entries (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  section_id BIGINT NOT NULL REFERENCES school_sections(id),
  subject_id BIGINT REFERENCES school_subjects(id),
  room_id BIGINT NOT NULL REFERENCES school_rooms(id),
  teacher_id BIGINT REFERENCES school_teachers(id),
  period_type TEXT NOT NULL,
  day_of_week INT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_timetable_section_day ON school_timetable_entries (section_id, day_of_week);

CREATE TABLE IF NOT EXISTS school_staff_duty_rosters (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_member_id BIGINT NOT NULL REFERENCES school_staff_members(id),
  zone_id BIGINT REFERENCES school_zones(id),
  duty_type TEXT NOT NULL,
  day_of_week INT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_critical_window BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_roster_zone_day ON school_staff_duty_rosters (zone_id, day_of_week);

CREATE TABLE IF NOT EXISTS school_compliance_configs (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  safety_rules JSONB NOT NULL DEFAULT '[]',
  restricted_zone_ids BIGINT[] NOT NULL DEFAULT '{}',
  audit_checklist JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id BIGINT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
