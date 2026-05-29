import type {
  EventAcknowledgement,
  EventSeverity,
  EventStatus,
  EventType,
  IntelligenceEvent,
  IntelligenceModule,
} from '../school-rule-engine/types';
import { hydrateEventsFromPg, hasEventsLoaded } from '../school-rule-engine/store';
import { dbQuery, isDbEnabled } from './pool';

function parseJson<T>(v: unknown): T {
  if (typeof v === 'string') return JSON.parse(v) as T;
  return (v ?? {}) as T;
}

function rowToEvent(r: Record<string, unknown>): IntelligenceEvent {
  const startedAt =
    r.started_at instanceof Date ? r.started_at.toISOString() : String(r.started_at);
  const createdAt =
    r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? startedAt);
  const updatedAt =
    r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at ? String(r.updated_at) : undefined;
  const endedAt =
    r.ended_at instanceof Date ? r.ended_at.toISOString() : r.ended_at ? String(r.ended_at) : undefined;

  return {
    id: Number(r.id),
    organizationId: Number(r.organization_id),
    ruleId: r.rule_id != null ? Number(r.rule_id) : undefined,
    eventType: String(r.event_type) as EventType,
    module: String(r.module) as IntelligenceModule,
    severity: String(r.severity) as EventSeverity,
    status: String(r.status) as EventStatus,
    cameraId: r.camera_id != null ? Number(r.camera_id) : undefined,
    zoneId: r.zone_id != null ? Number(r.zone_id) : undefined,
    roomId: r.room_id != null ? Number(r.room_id) : undefined,
    classId: r.class_id != null ? Number(r.class_id) : undefined,
    periodId: r.period_id != null ? Number(r.period_id) : undefined,
    startedAt,
    endedAt,
    confidence: r.confidence != null ? Number(r.confidence) : undefined,
    evidence: parseJson<IntelligenceEvent['evidence']>(r.evidence),
    createdAt,
    updatedAt,
  };
}

function rowToAck(r: Record<string, unknown>): EventAcknowledgement {
  return {
    id: Number(r.id),
    eventId: Number(r.event_id),
    userId: r.user_id != null ? Number(r.user_id) : undefined,
    action: String(r.action) as EventAcknowledgement['action'],
    note: r.note != null ? String(r.note) : undefined,
    createdAt:
      r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? new Date().toISOString()),
  };
}

/** Load intelligence events (+ acks) from Postgres into the in-memory rule engine store. */
export async function loadEventsFromPg(organizationId: number): Promise<boolean> {
  if (!isDbEnabled()) return false;
  if (hasEventsLoaded(organizationId)) return true;

  const eventR = await dbQuery<Record<string, unknown>>(
    `SELECT id, organization_id, rule_id, event_type, module, severity, status,
            camera_id, zone_id, room_id, class_id, period_id,
            started_at, ended_at, confidence, evidence, created_at, updated_at
     FROM school_intelligence_events
     WHERE organization_id = $1
     ORDER BY started_at DESC`,
    [organizationId],
  );
  const rows = (eventR?.rows ?? []).map(rowToEvent);
  if (!rows.length) return false;

  const eventIds = rows.map((e) => e.id);
  const ackR = await dbQuery<Record<string, unknown>>(
    `SELECT id, event_id, user_id, action, note, created_at
     FROM school_event_acknowledgements
     WHERE event_id = ANY($1::bigint[])
     ORDER BY created_at ASC`,
    [eventIds],
  );
  const ackRows = (ackR?.rows ?? []).map(rowToAck);

  hydrateEventsFromPg(organizationId, rows, ackRows);
  return true;
}

export async function ensureRuleEngineHydrated(organizationId: number) {
  if (!isDbEnabled()) return { source: 'none' as const };
  const loaded = await loadEventsFromPg(organizationId);
  return { source: loaded ? ('postgres' as const) : ('none' as const) };
}

/** Load the event's organization from Postgres and hydrate the rule engine store if needed. */
export async function ensureEventHydrated(eventId: number) {
  const { getEvent } = await import('../school-rule-engine/store');
  const existing = getEvent(eventId);
  if (existing) return { organizationId: existing.organizationId, source: 'memory' as const };

  if (!isDbEnabled()) return { organizationId: null, source: 'none' as const };

  const row = await dbQuery<{ organization_id: number }>(
    `SELECT organization_id FROM school_intelligence_events WHERE id = $1 LIMIT 1`,
    [eventId],
  );
  const organizationId = row?.rows[0]?.organization_id;
  if (organizationId == null) return { organizationId: null, source: 'none' as const };

  const hydrated = await ensureRuleEngineHydrated(Number(organizationId));
  return { organizationId: Number(organizationId), source: hydrated.source };
}
