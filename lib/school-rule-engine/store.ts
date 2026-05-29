import { DEFAULT_RULE_TEMPLATES } from './rules';
import { assertRuleEnablePhase1Context } from './rule-enable-validation';
import { logAudit, setAuditActor } from '../school-foundation/store';
import type {
  EventAcknowledgement, EventStatus, EventType, IntelligenceEvent, IntelligenceRule, RuleCondition,
} from './types';

let nextRuleId = 1;
let nextCondId = 1;
let nextEventId = 1;
let nextAckId = 1;

const rules: IntelligenceRule[] = [];
const conditions: RuleCondition[] = [];
const events: IntelligenceEvent[] = [];
const acks: EventAcknowledgement[] = [];

const now = () => new Date().toISOString();

export function resetRuleEngineStore() {
  rules.length = 0;
  conditions.length = 0;
  events.length = 0;
  acks.length = 0;
  nextRuleId = 1;
  nextCondId = 1;
  nextEventId = 1;
  nextAckId = 1;
}

export function seedDefaultRules(organizationId = 1) {
  resetRuleEngineStore();
  for (const tpl of DEFAULT_RULE_TEMPLATES) {
    const rule: IntelligenceRule = {
      id: nextRuleId++,
      organizationId,
      name: tpl.name,
      eventType: tpl.eventType,
      module: tpl.module,
      enabled: tpl.enabled,
      severityDefault: tpl.severityDefault,
      cooldownSeconds: tpl.cooldownSeconds,
      version: tpl.version,
      createdAt: now(),
    };
    rules.push(rule);
    for (const c of tpl.conditions) {
      conditions.push({
        id: nextCondId++,
        ruleId: rule.id,
        conditionType: c.conditionType,
        parameters: c.parameters,
        sortOrder: c.sortOrder,
      });
    }
  }
  return { rules: rules.length, conditions: conditions.length };
}

export function listRules(organizationId: number) {
  return rules.filter((r) => r.organizationId === organizationId);
}

export function getRule(id: number) {
  return rules.find((r) => r.id === id);
}

export function listConditionsForRule(ruleId: number) {
  return conditions.filter((c) => c.ruleId === ruleId).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function createRule(
  input: Omit<IntelligenceRule, 'id' | 'createdAt'> & { conditions?: Omit<RuleCondition, 'id' | 'ruleId'>[] }
) {
  const { conditions: conds, ...ruleInput } = input;
  const row: IntelligenceRule = { ...ruleInput, id: nextRuleId++, createdAt: now() };
  const condsForVal: RuleCondition[] = (conds?.length ? conds : []).map((c) => ({
    id: 0,
    ruleId: row.id,
    conditionType: c.conditionType,
    parameters: c.parameters,
    sortOrder: c.sortOrder,
  }));
  if (row.enabled) {
    assertRuleEnablePhase1Context(row, condsForVal);
  }
  rules.push(row);
  if (conds?.length) {
    for (const c of conds) {
      conditions.push({ id: nextCondId++, ruleId: row.id, ...c });
    }
  }
  logAudit('create', 'intelligence_rule', row.id, row);
  return row;
}

export function updateRule(
  id: number,
  patch: Partial<IntelligenceRule> & { conditions?: Omit<RuleCondition, 'id' | 'ruleId'>[] }
) {
  const i = rules.findIndex((r) => r.id === id);
  if (i < 0) throw new Error('Rule not found');
  const before = { ...rules[i] };
  const { conditions: conds, ...rulePatch } = patch;
  const nextRule: IntelligenceRule = { ...rules[i], ...rulePatch };
  let condsForValidation: RuleCondition[];
  if (conds?.length) {
    condsForValidation = conds.map((c, idx) => ({
      id: idx,
      ruleId: id,
      conditionType: c.conditionType,
      parameters: c.parameters,
      sortOrder: c.sortOrder,
    }));
  } else {
    condsForValidation = listConditionsForRule(id);
    if (!condsForValidation.length) {
      condsForValidation = [{ id: 0, ruleId: id, conditionType: 'signal_threshold', parameters: {}, sortOrder: 0 }];
    }
  }
  if (nextRule.enabled) {
    assertRuleEnablePhase1Context(nextRule, condsForValidation);
  }
  const versionBump = conds != null || rulePatch.severityDefault != null || rulePatch.cooldownSeconds != null;
  rules[i] = {
    ...rules[i],
    ...rulePatch,
    version: versionBump ? (rules[i].version ?? 1) + 1 : rules[i].version,
    updatedAt: now(),
  };
  if (conds?.length) {
    for (let j = conditions.length - 1; j >= 0; j--) {
      if (conditions[j].ruleId === id) conditions.splice(j, 1);
    }
    for (const c of conds) {
      conditions.push({ id: nextCondId++, ruleId: id, ...c });
    }
  }
  logAudit('update', 'intelligence_rule', id, rules[i], before);
  return rules[i];
}

export function deleteRule(id: number) {
  const i = rules.findIndex((r) => r.id === id);
  if (i < 0) throw new Error('Rule not found');
  const before = rules[i];
  rules[i].enabled = false;
  rules[i].updatedAt = now();
  logAudit('delete', 'intelligence_rule', id, rules[i], before);
}


export function getLastEventStartedAtForRule(ruleId: number): string | undefined {
  let best: string | undefined;
  for (const e of events) {
    if (e.ruleId !== ruleId) continue;
    if (!best || e.startedAt > best) best = e.startedAt;
  }
  return best;
}

export function listEvents(
  organizationId: number,
  filters?: { from?: string; to?: string; eventType?: EventType; status?: EventStatus; zoneId?: number }
) {
  let rows = events.filter((e) => e.organizationId === organizationId);
  if (filters?.eventType) rows = rows.filter((e) => e.eventType === filters.eventType);
  if (filters?.status) rows = rows.filter((e) => e.status === filters.status);
  if (filters?.from) rows = rows.filter((e) => e.startedAt >= filters.from!);
  if (filters?.to) rows = rows.filter((e) => e.startedAt <= filters.to!);
  if (filters?.zoneId != null) rows = rows.filter((e) => e.zoneId === filters.zoneId);
  return rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function getEvent(id: number) {
  return events.find((e) => e.id === id);
}

export function createEvent(input: Omit<IntelligenceEvent, 'id' | 'createdAt'>) {
  const row: IntelligenceEvent = { ...input, id: nextEventId++, createdAt: now() };
  events.push(row);
  return row;
}

export function isInCooldown(rule: IntelligenceRule, match: Pick<IntelligenceEvent, 'cameraId' | 'roomId' | 'eventType' | 'startedAt'>) {
  const since = new Date(match.startedAt).getTime() - rule.cooldownSeconds * 1000;
  return events.some(
    (e) => e.organizationId === rule.organizationId && e.ruleId === rule.id && e.eventType === match.eventType &&
      e.cameraId === match.cameraId && e.roomId === match.roomId &&
      new Date(e.startedAt).getTime() >= since
  );
}

export function acknowledgeEvent(eventId: number, userId?: number, note?: string) {
  const ev = getEvent(eventId);
  if (!ev) throw new Error('Event not found');
  ev.status = 'Acknowledged';
  ev.acknowledgedAt = now();
  ev.updatedAt = now();
  acks.push({ id: nextAckId++, eventId, userId, action: 'ack', note, createdAt: now() });
  return ev;
}

export function assignEvent(eventId: number, assignedTo: string, userId?: number, note?: string) {
  const ev = getEvent(eventId);
  if (!ev) throw new Error('Event not found');
  ev.status = 'Assigned';
  ev.assignedTo = assignedTo;
  ev.updatedAt = now();
  acks.push({ id: nextAckId++, eventId, userId, action: 'assign', note, createdAt: now() });
  return ev;
}

export function resolveEvent(eventId: number, userId?: number, note?: string) {
  const ev = getEvent(eventId);
  if (!ev) throw new Error('Event not found');
  ev.status = 'Resolved';
  ev.resolvedAt = now();
  ev.endedAt = ev.endedAt ?? now();
  ev.updatedAt = now();
  acks.push({ id: nextAckId++, eventId, userId, action: 'resolve', note, createdAt: now() });
  return ev;
}

export function listAcknowledgements(eventId: number) {
  return acks.filter((a) => a.eventId === eventId);
}

export function hasEventsLoaded(organizationId: number) {
  return events.some((e) => e.organizationId === organizationId);
}

/** Replace in-memory events for an organization with rows loaded from Postgres. */
export function hydrateEventsFromPg(
  organizationId: number,
  rows: IntelligenceEvent[],
  ackRows: EventAcknowledgement[],
) {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].organizationId === organizationId) events.splice(i, 1);
  }
  const loadedIds = new Set(rows.map((r) => r.id));
  for (let i = acks.length - 1; i >= 0; i--) {
    if (loadedIds.has(acks[i].eventId)) acks.splice(i, 1);
  }
  events.push(...rows);
  acks.push(...ackRows);
  for (const r of rows) if (r.id >= nextEventId) nextEventId = r.id + 1;
  for (const a of ackRows) if (a.id >= nextAckId) nextAckId = a.id + 1;
}

export function listNotifications(organizationId: number, unreadOnly = false) {
  const rows = listEvents(organizationId);
  const filtered = unreadOnly
    ? rows.filter((e) => e.status === 'Open' || e.status === 'Assigned')
    : rows;
  return filtered.slice(0, 100).map((e) => ({
    id: e.id,
    organizationId: e.organizationId,
    title: e.eventType,
    body: e.evidence?.summary ?? '',
    read: e.status !== 'Open' && e.status !== 'Assigned',
    createdAt: e.createdAt ?? e.startedAt,
    eventId: e.id,
    status: e.status,
  }));
}

export const ruleDb = { rules: () => rules, conditions: () => conditions, events: () => events, acks: () => acks };

export { evaluateRules } from './evaluate';
