import { db } from '../school-foundation/store';
import { querySignalsForEvaluation } from '../school-ai-signals/store';
import type { AiSignal } from '../school-ai-signals/types';
import type { EventType, IntelligenceEvent, IntelligenceRule, RuleCondition } from './types';
import { listRules, listConditionsForRule, createEvent, isInCooldown } from './store';
import { maybeNotifyEvent } from './notifications';

const now = () => new Date().toISOString();

function isHoliday(organizationId: number, date: string) {
  const row = db.calendar().find((c) => c.organizationId === organizationId && c.calendarDate === date);
  return row?.dayType === 'Holiday';
}

function roomForCamera(cameraId: number) {
  return db.cameras().find((c) => c.id === cameraId)?.roomId;
}

function roomCapacity(roomId?: number) {
  if (!roomId) return 35;
  return db.rooms().find((r) => r.id === roomId)?.capacity ?? 35;
}

function latestSignal(sigs: AiSignal[], cameraId: number, type: string) {
  return sigs
    .filter((s) => s.cameraId === cameraId && s.signalType === type)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
}

function minutesBetween(isoA: string, isoB: string) {
  return (new Date(isoB).getTime() - new Date(isoA).getTime()) / 60_000;
}

function latestOfTypeAtOrBefore(sigs: AiSignal[], cameraId: number, signalType: string, atIso: string): AiSignal | undefined {
  return sigs
    .filter((s) => s.cameraId === cameraId && s.signalType === signalType && s.observedAt <= atIso)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
}

function maxObservedAt(sigs: AiSignal[]): string {
  if (!sigs.length) return now();
  return sigs.reduce((best, x) => (x.observedAt > best ? x.observedAt : best), sigs[0].observedAt);
}

function signalsAbove(sigs: AiSignal[], cameraId: number, type: string, min: number) {
  return sigs.filter((s) => s.cameraId === cameraId && s.signalType === type && s.signalValue >= min);
}

type Match = Omit<IntelligenceEvent, 'id' | 'createdAt' | 'status'>;

function evalCondition(
  rule: IntelligenceRule,
  cond: RuleCondition,
  organizationId: number,
  sigs: AiSignal[]
): Match[] {
  const cameras = db.cameras().filter((c) => c.organizationId === organizationId && c.status === 'Active');
  const matches: Match[] = [];
  const p = cond.parameters;

  if (cond.conditionType === 'signal_threshold') {
    const st = String(p.signalType);
    const minValue = Number(p.minValue ?? 0.5);
    for (const cam of cameras) {
      const hit = signalsAbove(sigs, cam.id, st, minValue);
      if (!hit.length) continue;
      const latest = hit[0];
      matches.push({
        organizationId,
        ruleId: rule.id,
        eventType: rule.eventType,
        module: rule.module,
        severity: rule.severityDefault,
        cameraId: cam.id,
        roomId: cam.roomId,
        zoneId: cam.zoneId,
        startedAt: latest.observedAt,
        confidence: latest.confidence,
        evidence: {
          summary: `${rule.name} on ${cam.name} (${st}=${latest.signalValue.toFixed(2)})`,
          signalIds: hit.slice(0, 5).map((s) => s.id),
          metrics: { signalType: st, value: latest.signalValue },
        },
      });
    }
  }

  if (cond.conditionType === 'no_teacher_with_students') {
    const minStudents = Number(p.minStudents ?? 5);
    const minMinutes = Number(p.minMinutes ?? 0);
    const purposeFilter = rule.eventType === 'LabSupervisionMissing' ? ['Lab'] : ['Classroom', 'Lab'];
    const windowEnd = maxObservedAt(sigs);

    for (const cam of cameras.filter((c) => purposeFilter.includes(c.purpose))) {
      if (minMinutes <= 0) {
        const pc = latestSignal(sigs, cam.id, 'PersonCount');
        const tp = latestSignal(sigs, cam.id, 'TeacherPresent');
        if (!pc || pc.signalValue < minStudents) continue;
        if (tp && tp.signalValue > 0.4) continue;
        matches.push({
          organizationId,
          ruleId: rule.id,
          eventType: rule.eventType,
          module: rule.module,
          severity: rule.severityDefault,
          cameraId: cam.id,
          roomId: cam.roomId,
          startedAt: pc.observedAt,
          confidence: pc.confidence,
          evidence: {
            summary: `Students present (${Math.round(pc.signalValue)}) without teacher on ${cam.name}`,
            signalIds: [pc.id, ...(tp ? [tp.id] : [])],
            metrics: { personCount: pc.signalValue, teacherPresent: tp?.signalValue ?? 0 },
          },
        });
        continue;
      }

      const boundary = new Set<string>();
      for (const x of sigs) {
        if (x.cameraId !== cam.id) continue;
        if (x.signalType === 'PersonCount' || x.signalType === 'TeacherPresent') boundary.add(x.observedAt);
      }
      const times = [...boundary].sort((a, b) => a.localeCompare(b));

      let badStart: string | null = null;
      let lastBadAt: string | null = null;

      const emitIf = (start: string, lastBad: string) => {
        if (minutesBetween(start, lastBad) < minMinutes) return;
        const pcL = latestOfTypeAtOrBefore(sigs, cam.id, 'PersonCount', lastBad);
        const tpL = latestOfTypeAtOrBefore(sigs, cam.id, 'TeacherPresent', lastBad);
        if (!pcL || pcL.signalValue < minStudents) return;
        if (tpL && tpL.signalValue > 0.4) return;
        matches.push({
          organizationId,
          ruleId: rule.id,
          eventType: rule.eventType,
          module: rule.module,
          severity: rule.severityDefault,
          cameraId: cam.id,
          roomId: cam.roomId,
          startedAt: start,
          confidence: pcL.confidence,
          evidence: {
            summary: `Students present (${Math.round(pcL.signalValue)}) without teacher for ≥${minMinutes}m on ${cam.name}`,
            signalIds: [pcL.id, ...(tpL ? [tpL.id] : [])],
            metrics: { personCount: pcL.signalValue, teacherPresent: tpL?.signalValue ?? 0, minMinutes },
          },
        });
      };

      for (const t of times) {
        const pc = latestOfTypeAtOrBefore(sigs, cam.id, 'PersonCount', t);
        const tp = latestOfTypeAtOrBefore(sigs, cam.id, 'TeacherPresent', t);
        const bad = Boolean(pc && pc.signalValue >= minStudents && (!tp || tp.signalValue <= 0.4));
        if (bad) {
          if (!badStart) badStart = t;
          lastBadAt = t;
        } else {
          if (badStart && lastBadAt) emitIf(badStart, lastBadAt);
          badStart = null;
          lastBadAt = null;
        }
      }
      if (badStart && lastBadAt) emitIf(badStart, lastBadAt);
    }
  }

  if (cond.conditionType === 'person_count_over_capacity') {
    const ratio = Number(p.ratio ?? 1.1);
    for (const cam of cameras.filter((c) => c.roomId)) {
      const pc = latestSignal(sigs, cam.id, 'PersonCount');
      if (!pc) continue;
      const cap = roomCapacity(cam.roomId);
      if (pc.signalValue <= cap * ratio) continue;
      matches.push({
        organizationId,
        ruleId: rule.id,
        eventType: rule.eventType,
        module: rule.module,
        severity: rule.severityDefault,
        cameraId: cam.id,
        roomId: cam.roomId,
        startedAt: pc.observedAt,
        confidence: pc.confidence,
        evidence: {
          summary: `Overcrowding in room (count ${Math.round(pc.signalValue)} vs capacity ${cap})`,
          signalIds: [pc.id],
          metrics: { personCount: pc.signalValue, capacity: cap },
        },
      });
    }
  }

  if (cond.conditionType === 'person_count_under_expected') {
    const ratio = Number(p.ratio ?? 0.35);
    for (const cam of cameras.filter((c) => c.purpose === 'Classroom' && c.roomId)) {
      const pc = latestSignal(sigs, cam.id, 'PersonCount');
      if (!pc) continue;
      const cap = roomCapacity(cam.roomId);
      if (pc.signalValue >= cap * ratio) continue;
      matches.push({
        organizationId,
        ruleId: rule.id,
        eventType: rule.eventType,
        module: rule.module,
        severity: rule.severityDefault,
        cameraId: cam.id,
        roomId: cam.roomId,
        startedAt: pc.observedAt,
        evidence: {
          summary: `Under-occupancy (${Math.round(pc.signalValue)} vs expected ~${cap})`,
          signalIds: [pc.id],
        },
      });
    }
  }

  if (cond.conditionType === 'empty_scheduled_room') {
    const maxPerson = Number(p.maxPersonCount ?? 2);
    const dow = new Date().getDay() || 7;
    const periods = db.timetable().filter((t) => t.organizationId === organizationId && t.isActive && t.dayOfWeek === dow);
    for (const period of periods) {
      const cam = cameras.find((c) => c.roomId === period.roomId);
      if (!cam) continue;
      const pc = latestSignal(sigs, cam.id, 'PersonCount');
      if (!pc || pc.signalValue > maxPerson) continue;
      matches.push({
        organizationId,
        ruleId: rule.id,
        eventType: rule.eventType,
        module: rule.module,
        severity: rule.severityDefault,
        cameraId: cam.id,
        roomId: period.roomId,
        periodId: period.id,
        startedAt: pc.observedAt,
        evidence: { summary: `Scheduled period with near-empty room`, signalIds: [pc.id] },
      });
    }
  }

  if (cond.conditionType === 'gate_queue') {
    const minQueue = Number(p.minQueue ?? 10);
    for (const cam of cameras.filter((c) => c.purpose === 'Gate')) {
      const q = latestSignal(sigs, cam.id, 'VehicleQueue') ?? latestSignal(sigs, cam.id, 'CrowdDensity');
      if (!q || q.signalValue < minQueue) continue;
      matches.push({
        organizationId,
        ruleId: rule.id,
        eventType: rule.eventType,
        module: rule.module,
        severity: rule.severityDefault,
        cameraId: cam.id,
        zoneId: cam.zoneId,
        startedAt: q.observedAt,
        evidence: { summary: `Gate queue depth ${Math.round(q.signalValue)}`, signalIds: [q.id] },
      });
    }
  }

  if (cond.conditionType === 'staff_absent_roster') {
    const dow = new Date().getDay() || 7;
    const rosters = db.rosters().filter((r) => r.organizationId === organizationId && r.isActive && r.dayOfWeek === dow);
    for (const roster of rosters) {
      const cam = cameras.find((c) => c.zoneId === roster.zoneId && c.purpose === 'Gate');
      if (!cam) continue;
      const staff = latestSignal(sigs, cam.id, 'StaffPresentAtGate');
      if (staff && staff.signalValue > 0.5) continue;
      matches.push({
        organizationId,
        ruleId: rule.id,
        eventType: rule.eventType,
        module: rule.module,
        severity: rule.severityDefault,
        cameraId: cam.id,
        zoneId: roster.zoneId,
        startedAt: staff?.observedAt ?? now(),
        evidence: { summary: `No staff at gate during roster window`, signalIds: staff ? [staff.id] : [] },
      });
    }
  }

  if (cond.conditionType === 'late_period_start') {
    const lateMinutes = Number(p.lateMinutes ?? 8);
    const dow = new Date().getDay() || 7;
    const periods = db.timetable().filter((t) => t.organizationId === organizationId && t.isActive && t.dayOfWeek === dow);
    for (const period of periods) {
      const cam = cameras.find((c) => c.roomId === period.roomId);
      if (!cam) continue;
      const startSig = latestSignal(sigs, cam.id, 'ClassStartTime');
      const pc = latestSignal(sigs, cam.id, 'PersonCount');
      if (!pc || pc.signalValue < 8) continue;
      if (!startSig || startSig.signalValue <= lateMinutes) continue;
      matches.push({
        organizationId,
        ruleId: rule.id,
        eventType: rule.eventType,
        module: rule.module,
        severity: rule.severityDefault,
        cameraId: cam.id,
        roomId: period.roomId,
        periodId: period.id,
        startedAt: startSig.observedAt,
        evidence: { summary: `Class start delayed ~${Math.round(startSig.signalValue)} min`, signalIds: [startSig.id, pc.id] },
      });
    }
  }

  if (cond.conditionType === 'overlap_signals') {
    const types = (p.types as string[]) ?? [];
    for (const cam of cameras.filter((c) => c.purpose === 'Gate')) {
      const hits = types.map((t) => latestSignal(sigs, cam.id, t)).filter(Boolean);
      if (hits.length < 2) continue;
      if (hits.some((h) => !h || h.signalValue < 5)) continue;
      matches.push({
        organizationId,
        ruleId: rule.id,
        eventType: rule.eventType,
        module: rule.module,
        severity: rule.severityDefault,
        cameraId: cam.id,
        startedAt: hits[0]!.observedAt,
        evidence: { summary: 'Vehicle and pedestrian overlap at gate', signalIds: hits.map((h) => h!.id) },
      });
    }
  }


  if (cond.conditionType === 'zone_entry_restricted') {
    for (const cam of cameras.filter((c) => c.purpose === 'RestrictedZone')) {
      const z = latestSignal(sigs, cam.id, 'ZoneEntry');
      if (!z || z.signalValue < 0.5) continue;
      matches.push({
        organizationId, ruleId: rule.id, eventType: rule.eventType, module: rule.module,
        severity: rule.severityDefault, cameraId: cam.id, zoneId: cam.zoneId, startedAt: z.observedAt,
        evidence: { summary: `Restricted zone entry on ${cam.name}`, signalIds: [z.id] },
      });
    }
  }

  if (cond.conditionType === 'zone_entry_server_room') {
    for (const cam of cameras) {
      const zone = db.zones().find((z) => z.id === cam.zoneId);
      if (!zone || (zone as { riskCategory?: string }).riskCategory !== 'ServerRoom') continue;
      const z = latestSignal(sigs, cam.id, 'ZoneEntry') ?? latestSignal(sigs, cam.id, 'PersonCount');
      if (!z || z.signalValue < 0.5) continue;
      matches.push({
        organizationId, ruleId: rule.id, eventType: rule.eventType, module: rule.module,
        severity: rule.severityDefault, cameraId: cam.id, zoneId: cam.zoneId, startedAt: z.observedAt,
        evidence: { summary: `Server room activity on ${cam.name}`, signalIds: [z.id] },
      });
    }
  }

  return matches;
}

export function evaluateRules(organizationId: number, opts?: { from?: string; to?: string }) {
  const today = new Date().toISOString().slice(0, 10);
  if (isHoliday(organizationId, today)) {
    return { skipped: true, reason: 'holiday' as const, created: 0, events: [] };
  }

  const to = opts?.to ?? now();
  const from = opts?.from ?? new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const sigs = querySignalsForEvaluation(organizationId, from, to);
  const rules = listRules(organizationId).filter((r) => r.enabled);
  let created = 0;
  const createdEvents: IntelligenceEvent[] = [];

  for (const rule of rules) {
    const conditions = listConditionsForRule(rule.id);
    const conds = conditions.length ? conditions : [{ id: 0, ruleId: rule.id, conditionType: 'signal_threshold', parameters: {}, sortOrder: 0 }];
    for (const cond of conds) {
      const matches = evalCondition(rule, cond, organizationId, sigs);
      for (const m of matches) {
        if (isInCooldown(rule, m)) continue;
        const ev = createEvent({ ...m, status: 'Open' });
        maybeNotifyEvent(organizationId, ev.id, ev.eventType, ev.severity, ev.evidence?.summary ?? ev.eventType);
        createdEvents.push(ev);
        created++;
      }
    }
  }

  return { skipped: false, created, events: createdEvents };
}
