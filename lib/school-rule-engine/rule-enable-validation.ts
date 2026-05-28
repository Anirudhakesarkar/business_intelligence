import { db } from '../school-foundation/store';
import type { IntelligenceRule, RuleCondition } from './types';

/**
 * When enabling a rule, ensure Phase 1 in-memory foundation has the entities
 * the evaluator needs for this condition type (cameras, timetable, rosters, zones).
 */
export function assertRuleEnablePhase1Context(
  rule: Pick<IntelligenceRule, 'organizationId' | 'eventType'>,
  conditionsToCheck: RuleCondition[],
): void {
  const orgId = rule.organizationId;
  const orgCams = db.cameras().filter((c) => c.organizationId === orgId && c.status === 'Active');

  const effective: RuleCondition[] =
    conditionsToCheck.length > 0
      ? conditionsToCheck
      : [{ id: 0, ruleId: 0, conditionType: 'signal_threshold', parameters: {}, sortOrder: 0 }];

  for (const cond of effective) {
    switch (cond.conditionType) {
      case 'gate_queue':
      case 'overlap_signals':
        if (!orgCams.some((c) => c.purpose === 'Gate')) {
          throw new Error('Cannot enable rule: add at least one active Gate camera (Phase 1).');
        }
        break;
      case 'no_teacher_with_students': {
        const labOnly = rule.eventType === 'LabSupervisionMissing';
        const ok = orgCams.some((c) =>
          labOnly ? c.purpose === 'Lab' : c.purpose === 'Classroom' || c.purpose === 'Lab',
        );
        if (!ok) {
          throw new Error(
            labOnly
              ? 'Cannot enable rule: add at least one active Lab camera (Phase 1).'
              : 'Cannot enable rule: add at least one active Classroom or Lab camera (Phase 1).',
          );
        }
        break;
      }
      case 'person_count_over_capacity':
      case 'person_count_under_expected':
        if (!orgCams.length) {
          throw new Error('Cannot enable rule: no active cameras for organization (Phase 1).');
        }
        if (!orgCams.some((c) => c.roomId)) {
          throw new Error('Cannot enable rule: assign cameras to rooms for occupancy rules (Phase 1).');
        }
        break;
      case 'empty_scheduled_room':
      case 'late_period_start': {
        const tt = db.timetable().filter((t) => t.organizationId === orgId && t.isActive);
        if (!tt.length) {
          throw new Error('Cannot enable rule: add active timetable entries (Phase 1).');
        }
        const roomIds = new Set(tt.map((t) => t.roomId));
        if (!orgCams.some((c) => c.roomId && roomIds.has(c.roomId))) {
          throw new Error('Cannot enable rule: place cameras in timetabled rooms (Phase 1).');
        }
        break;
      }
      case 'staff_absent_roster': {
        const rosters = db.rosters().filter((r) => r.organizationId === orgId && r.isActive);
        if (!rosters.length) {
          throw new Error('Cannot enable rule: add active staff duty rosters (Phase 1).');
        }
        if (!orgCams.some((c) => c.purpose === 'Gate')) {
          throw new Error('Cannot enable rule: add an active Gate camera for roster checks (Phase 1).');
        }
        break;
      }
      case 'zone_entry_restricted':
        if (!orgCams.some((c) => c.purpose === 'RestrictedZone')) {
          throw new Error('Cannot enable rule: add an active RestrictedZone camera (Phase 1).');
        }
        break;
      case 'zone_entry_server_room': {
        const has = orgCams.some((c) => {
          if (!c.zoneId) return false;
          const zone = db.zones().find((z) => z.id === c.zoneId);
          return Boolean(zone && (zone as { riskCategory?: string }).riskCategory === 'ServerRoom');
        });
        if (!has) {
          throw new Error('Cannot enable rule: place a camera in a ServerRoom zone (Phase 1).');
        }
        break;
      }
      case 'signal_threshold':
      default:
        if (!orgCams.length) {
          throw new Error('Cannot enable rule: no active cameras for organization (Phase 1).');
        }
        break;
    }
  }
}
