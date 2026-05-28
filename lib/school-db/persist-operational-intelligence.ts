import { dbQuery, isDbEnabled } from './pool';
import { ruleDb } from '../school-rule-engine/store';
import { aiDb } from '../school-ai-signals/store';
import { createActionFromRecommendation, gptDb, listActions } from '../school-gpt-copilot/store';

export async function persistOperationalIntelligenceForOrg(organizationId: number) {
  if (!isDbEnabled()) return;

  await persistRulesAndConditions(organizationId);
  await persistEventsAndAcknowledgements(organizationId);
  await persistAiSignals(organizationId);
  await persistAiHealthAndConfigs(organizationId);
  await persistGptRecommendationsAndActions(organizationId);
  await persistGptChats(organizationId);
}

async function persistRulesAndConditions(organizationId: number) {
  const rules = ruleDb.rules().filter((r) => r.organizationId === organizationId);
  const ruleIds = new Set(rules.map((r) => r.id));
  const conditions = ruleDb.conditions().filter((c) => ruleIds.has(c.ruleId));

  for (const row of rules) {
    await dbQuery(
      `INSERT INTO school_intelligence_rules
        (id, organization_id, name, event_type, module, enabled, severity_default, cooldown_seconds, version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz, $11::timestamptz)
       ON CONFLICT (id) DO UPDATE SET
         organization_id = EXCLUDED.organization_id,
         name = EXCLUDED.name,
         event_type = EXCLUDED.event_type,
         module = EXCLUDED.module,
         enabled = EXCLUDED.enabled,
         severity_default = EXCLUDED.severity_default,
         cooldown_seconds = EXCLUDED.cooldown_seconds,
         version = EXCLUDED.version,
         created_at = EXCLUDED.created_at,
         updated_at = EXCLUDED.updated_at`,
      [
        row.id,
        row.organizationId,
        row.name,
        row.eventType,
        row.module,
        row.enabled,
        row.severityDefault,
        row.cooldownSeconds,
        row.version,
        row.createdAt,
        row.updatedAt ?? null,
      ]
    );
  }

  for (const row of conditions) {
    await dbQuery(
      `INSERT INTO school_rule_conditions
        (id, rule_id, condition_type, parameters, sort_order)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (id) DO UPDATE SET
         rule_id = EXCLUDED.rule_id,
         condition_type = EXCLUDED.condition_type,
         parameters = EXCLUDED.parameters,
         sort_order = EXCLUDED.sort_order`,
      [row.id, row.ruleId, row.conditionType, JSON.stringify(row.parameters ?? {}), row.sortOrder]
    );
  }
}

async function persistEventsAndAcknowledgements(organizationId: number) {
  const events = ruleDb.events().filter((e) => e.organizationId === organizationId);
  const eventIds = new Set(events.map((e) => e.id));
  const acks = ruleDb.acks().filter((a) => eventIds.has(a.eventId));
  const [cameraRows, zoneRows, roomRows, classRows] = await Promise.all([
    dbQuery<{ id: number }>(`SELECT id FROM school_mgmt_cameras WHERE organization_id = $1`, [organizationId]),
    dbQuery<{ id: number }>(`SELECT id FROM school_zones`),
    dbQuery<{ id: number }>(`SELECT id FROM school_rooms`),
    dbQuery<{ id: number }>(`SELECT id FROM school_classes WHERE organization_id = $1`, [organizationId]),
  ]);
  const validCameraIds = new Set((cameraRows?.rows ?? []).map((r) => Number(r.id)));
  const validZoneIds = new Set((zoneRows?.rows ?? []).map((r) => Number(r.id)));
  const validRoomIds = new Set((roomRows?.rows ?? []).map((r) => Number(r.id)));
  const validClassIds = new Set((classRows?.rows ?? []).map((r) => Number(r.id)));

  for (const row of events) {
    await dbQuery(
      `INSERT INTO school_intelligence_events
        (id, organization_id, rule_id, event_type, module, severity, status, camera_id, zone_id, room_id, class_id, period_id,
         started_at, ended_at, confidence, evidence, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz, $14::timestamptz, $15, $16::jsonb,
         $17::timestamptz, $18::timestamptz)
       ON CONFLICT (id) DO UPDATE SET
         organization_id = EXCLUDED.organization_id,
         rule_id = EXCLUDED.rule_id,
         event_type = EXCLUDED.event_type,
         module = EXCLUDED.module,
         severity = EXCLUDED.severity,
         status = EXCLUDED.status,
         camera_id = EXCLUDED.camera_id,
         zone_id = EXCLUDED.zone_id,
         room_id = EXCLUDED.room_id,
         class_id = EXCLUDED.class_id,
         period_id = EXCLUDED.period_id,
         started_at = EXCLUDED.started_at,
         ended_at = EXCLUDED.ended_at,
         confidence = EXCLUDED.confidence,
         evidence = EXCLUDED.evidence,
         created_at = EXCLUDED.created_at,
         updated_at = EXCLUDED.updated_at`,
      [
        row.id,
        row.organizationId,
        row.ruleId ?? null,
        row.eventType,
        row.module,
        row.severity,
        row.status,
        row.cameraId && validCameraIds.has(row.cameraId) ? row.cameraId : null,
        row.zoneId && validZoneIds.has(row.zoneId) ? row.zoneId : null,
        row.roomId && validRoomIds.has(row.roomId) ? row.roomId : null,
        row.classId && validClassIds.has(row.classId) ? row.classId : null,
        row.periodId ?? null,
        row.startedAt,
        row.endedAt ?? null,
        row.confidence ?? null,
        JSON.stringify(row.evidence ?? {}),
        row.createdAt,
        row.updatedAt ?? null,
      ]
    );
  }

  for (const row of acks) {
    await dbQuery(
      `INSERT INTO school_event_acknowledgements
        (id, event_id, user_id, action, note, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::timestamptz)
       ON CONFLICT (id) DO UPDATE SET
         event_id = EXCLUDED.event_id,
         user_id = EXCLUDED.user_id,
         action = EXCLUDED.action,
         note = EXCLUDED.note,
         created_at = EXCLUDED.created_at`,
      [row.id, row.eventId, row.userId ?? null, row.action, row.note ?? null, row.createdAt]
    );
  }
}

async function persistAiSignals(organizationId: number) {
  const workerIds = new Set<number>();
  for (const row of aiDb.workers()) {
    await dbQuery(
      `INSERT INTO school_ai_workers
        (id, worker_key, worker_type, version, status, capabilities, registered_at, last_heartbeat_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz, $8::timestamptz)
       ON CONFLICT (id) DO UPDATE SET
         worker_key = EXCLUDED.worker_key,
         worker_type = EXCLUDED.worker_type,
         version = EXCLUDED.version,
         status = EXCLUDED.status,
         capabilities = EXCLUDED.capabilities,
         registered_at = EXCLUDED.registered_at,
         last_heartbeat_at = EXCLUDED.last_heartbeat_at`,
      [
        row.id,
        row.workerKey,
        row.workerType,
        row.version,
        row.status,
        JSON.stringify(row.capabilities ?? []),
        row.registeredAt,
        row.lastHeartbeatAt ?? null,
      ]
    );
    workerIds.add(row.id);
  }

  for (const row of aiDb.heartbeats()) {
    if (!workerIds.has(row.workerId)) continue;
    await dbQuery(
      `INSERT INTO school_ai_worker_heartbeats (id, worker_id, observed_at, metrics)
       VALUES ($1, $2, $3::timestamptz, $4::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         worker_id = EXCLUDED.worker_id,
         observed_at = EXCLUDED.observed_at,
         metrics = EXCLUDED.metrics`,
      [row.id, row.workerId, row.observedAt, JSON.stringify(row.metrics ?? {})]
    );
  }

  const orgCameraIdsRes = await dbQuery<{ id: number }>(
    `SELECT id FROM school_mgmt_cameras WHERE organization_id = $1`,
    [organizationId]
  );
  const orgCameraIds = new Set((orgCameraIdsRes?.rows ?? []).map((r) => Number(r.id)));
  const batchIds = new Set<number>();

  for (const row of aiDb.batches()) {
    if (!orgCameraIds.has(row.cameraId)) continue;
    await dbQuery(
      `INSERT INTO school_ai_signal_batches
        (id, batch_key, camera_id, worker_id, model_version, frame_count, started_at, ended_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz)
       ON CONFLICT (id) DO UPDATE SET
         batch_key = EXCLUDED.batch_key,
         camera_id = EXCLUDED.camera_id,
         worker_id = EXCLUDED.worker_id,
         model_version = EXCLUDED.model_version,
         frame_count = EXCLUDED.frame_count,
         started_at = EXCLUDED.started_at,
         ended_at = EXCLUDED.ended_at`,
      [
        row.id,
        row.batchKey,
        row.cameraId,
        row.workerId ?? null,
        row.modelVersion,
        row.frameCount,
        row.startedAt,
        row.endedAt ?? null,
      ]
    );
    batchIds.add(row.id);
  }

  for (const row of aiDb.signals()) {
    if (!orgCameraIds.has(row.cameraId)) continue;
    await dbQuery(
      `INSERT INTO school_ai_signals
        (id, camera_id, batch_id, signal_type, signal_value, confidence, observed_at, metadata)
       VALUES ($1, $2, $3, $4::school_signal_type, $5, $6, $7::timestamptz, $8::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         camera_id = EXCLUDED.camera_id,
         batch_id = EXCLUDED.batch_id,
         signal_type = EXCLUDED.signal_type,
         signal_value = EXCLUDED.signal_value,
         confidence = EXCLUDED.confidence,
         observed_at = EXCLUDED.observed_at,
         metadata = EXCLUDED.metadata`,
      [
        row.id,
        row.cameraId,
        row.batchId && batchIds.has(row.batchId) ? row.batchId : null,
        row.signalType,
        row.signalValue,
        row.confidence ?? null,
        row.observedAt,
        JSON.stringify(row.metadata ?? {}),
      ]
    );
  }
}

async function persistAiHealthAndConfigs(organizationId: number) {
  const orgCameraIdsRes = await dbQuery<{ id: number }>(
    `SELECT id FROM school_mgmt_cameras WHERE organization_id = $1`,
    [organizationId]
  );
  const orgCameraIds = new Set((orgCameraIdsRes?.rows ?? []).map((r) => Number(r.id)));

  for (const row of aiDb.healthEvents()) {
    if (!orgCameraIds.has(row.cameraId)) continue;
    await dbQuery(
      `INSERT INTO school_camera_health_events
        (id, camera_id, health_status, started_at, ended_at, metadata)
       VALUES ($1, $2, $3::school_health_status, $4::timestamptz, $5::timestamptz, $6::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         camera_id = EXCLUDED.camera_id,
         health_status = EXCLUDED.health_status,
         started_at = EXCLUDED.started_at,
         ended_at = EXCLUDED.ended_at,
         metadata = EXCLUDED.metadata`,
      [row.id, row.cameraId, row.healthStatus, row.startedAt, row.endedAt ?? null, JSON.stringify(row.metadata ?? {})]
    );
  }

  for (const row of aiDb.configs()) {
    if (!orgCameraIds.has(row.cameraId)) continue;
    await dbQuery(
      `INSERT INTO school_camera_processing_configs
        (camera_id, sample_rate, min_confidence, enabled_signals, zone_polygons, snapshot_enabled, active_processing, updated_at)
       VALUES ($1, $2, $3, $4::school_signal_type[], $5::jsonb, $6, $7, $8::timestamptz)
       ON CONFLICT (camera_id) DO UPDATE SET
         sample_rate = EXCLUDED.sample_rate,
         min_confidence = EXCLUDED.min_confidence,
         enabled_signals = EXCLUDED.enabled_signals,
         zone_polygons = EXCLUDED.zone_polygons,
         snapshot_enabled = EXCLUDED.snapshot_enabled,
         active_processing = EXCLUDED.active_processing,
         updated_at = EXCLUDED.updated_at`,
      [
        row.cameraId,
        row.sampleRate,
        row.minConfidence,
        row.enabledSignals,
        JSON.stringify(row.zonePolygons ?? {}),
        row.snapshotEnabled,
        row.activeProcessing,
        row.updatedAt,
      ]
    );
  }
}

async function persistGptRecommendationsAndActions(organizationId: number) {
  const recommendations = gptDb.recommendations().filter((r) => r.organizationId === organizationId);
  const actions = gptDb.actions().filter((a) => a.organizationId === organizationId);
  if (recommendations.length > 0 && actions.length === 0) {
    for (const rec of recommendations.slice(0, 3)) createActionFromRecommendation(organizationId, rec.id);
  }
  const recommendationIds = new Set<number>();
  for (const row of recommendations) {
    await dbQuery(
      `INSERT INTO school_gpt_recommendations
        (id, organization_id, site_id, summary_date, priority, module_key, title, rationale, suggested_action, expected_impact, citations, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::timestamptz)
       ON CONFLICT (id) DO UPDATE SET
         organization_id = EXCLUDED.organization_id,
         site_id = EXCLUDED.site_id,
         summary_date = EXCLUDED.summary_date,
         priority = EXCLUDED.priority,
         module_key = EXCLUDED.module_key,
         title = EXCLUDED.title,
         rationale = EXCLUDED.rationale,
         suggested_action = EXCLUDED.suggested_action,
         expected_impact = EXCLUDED.expected_impact,
         citations = EXCLUDED.citations,
         created_at = EXCLUDED.created_at`,
      [
        row.id,
        row.organizationId,
        row.siteId ?? null,
        row.summaryDate,
        row.priority,
        row.moduleKey,
        row.title,
        row.rationale,
        row.suggestedAction,
        row.expectedImpact ?? null,
        JSON.stringify(row.citations ?? []),
        row.createdAt,
      ]
    );
    recommendationIds.add(row.id);
  }

  for (const row of listActions(organizationId)) {
    await dbQuery(
      `INSERT INTO school_gpt_action_tasks
        (id, organization_id, recommendation_id, summary_date, title, assignee, status, due_date, completed_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9::timestamptz, $10::timestamptz)
       ON CONFLICT (id) DO UPDATE SET
         organization_id = EXCLUDED.organization_id,
         recommendation_id = EXCLUDED.recommendation_id,
         summary_date = EXCLUDED.summary_date,
         title = EXCLUDED.title,
         assignee = EXCLUDED.assignee,
         status = EXCLUDED.status,
         due_date = EXCLUDED.due_date,
         completed_at = EXCLUDED.completed_at,
         created_at = EXCLUDED.created_at`,
      [
        row.id,
        row.organizationId,
        row.recommendationId && recommendationIds.has(row.recommendationId) ? row.recommendationId : null,
        row.summaryDate,
        row.title,
        row.assignee ?? null,
        row.status,
        row.dueDate ?? null,
        row.completedAt ?? null,
        row.createdAt,
      ]
    );
  }
}

async function persistGptChats(organizationId: number) {
  const chats = gptDb.chats().filter((c) => c.organizationId === organizationId);
  for (const row of chats) {
    await dbQuery(
      `INSERT INTO school_gpt_chats
        (id, organization_id, conversation_id, summary_date, question, answer, citations, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::timestamptz)
       ON CONFLICT (id) DO UPDATE SET
         organization_id = EXCLUDED.organization_id,
         conversation_id = EXCLUDED.conversation_id,
         summary_date = EXCLUDED.summary_date,
         question = EXCLUDED.question,
         answer = EXCLUDED.answer,
         citations = EXCLUDED.citations,
         created_at = EXCLUDED.created_at`,
      [
        row.id,
        row.organizationId,
        row.conversationId,
        row.summaryDate,
        row.question,
        row.answer,
        JSON.stringify(row.citations ?? []),
        row.createdAt,
      ]
    );
  }
}
