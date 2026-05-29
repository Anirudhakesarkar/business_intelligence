import type { EventAcknowledgement, IntelligenceEvent } from '../school-rule-engine/types';
import { dbQuery, isDbEnabled } from './pool';

/** Persist event status update and optional acknowledgement row after in-memory mutation. */
export async function persistEventLifecycle(event: IntelligenceEvent, ack?: EventAcknowledgement) {
  if (!isDbEnabled()) return;

  await dbQuery(
    `UPDATE school_intelligence_events
     SET status = $1, ended_at = COALESCE($2::timestamptz, ended_at), updated_at = NOW()
     WHERE id = $3`,
    [event.status, event.endedAt ?? null, event.id],
  );

  if (ack) {
    await dbQuery(
      `INSERT INTO school_event_acknowledgements (id, event_id, user_id, action, note, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::timestamptz)
       ON CONFLICT (id) DO NOTHING`,
      [ack.id, ack.eventId, ack.userId ?? null, ack.action, ack.note ?? null, ack.createdAt],
    );
  }
}
