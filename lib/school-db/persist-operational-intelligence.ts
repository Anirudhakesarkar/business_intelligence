import { dbQuery, isDbEnabled } from './pool';
import { ruleDb } from '../school-rule-engine/store';
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

/** AI telemetry tables removed (migration 076); signals stay in-memory for rule evaluation only. */
async function persistAiSignals(_organizationId: number) {}

async function persistAiHealthAndConfigs(_organizationId: number) {}

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
