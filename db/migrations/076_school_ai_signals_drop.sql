-- Drop School Management Phase 2 telemetry tables (AI health / signals / workers UI removed).
-- In-memory signal store remains for rule evaluation in demo mode.

DROP TABLE IF EXISTS school_diagnostic_media CASCADE;
DROP TABLE IF EXISTS school_camera_processing_configs CASCADE;
DROP TABLE IF EXISTS school_camera_health_events CASCADE;
DROP TABLE IF EXISTS school_ai_signals CASCADE;
DROP TABLE IF EXISTS school_ai_signal_batches CASCADE;
DROP TABLE IF EXISTS school_ai_worker_heartbeats CASCADE;
DROP TABLE IF EXISTS school_ai_workers CASCADE;

DROP TYPE IF EXISTS school_signal_type CASCADE;
DROP TYPE IF EXISTS school_health_status CASCADE;
