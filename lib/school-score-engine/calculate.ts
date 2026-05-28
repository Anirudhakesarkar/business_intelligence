import type { EventType } from '../school-rule-engine/types';
import { listEvents } from '../school-rule-engine/store';
import type { ScoreDriver, ScoreInputsBundle, ScoreModuleKey } from './types';

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function num(v: unknown, fallback = 0) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function countEventTypes(organizationId: number, date: string, types: EventType[]) {
  const from = `${date}T00:00:00.000Z`;
  const to = `${date}T23:59:59.999Z`;
  return listEvents(organizationId, { from, to }).filter((e) => types.includes(e.eventType)).length;
}

export function computeSafetyScore(organizationId: number, date: string, inputs: ScoreInputsBundle) {
  const fall = countEventTypes(organizationId, date, ['FallDetected']);
  const fire = countEventTypes(organizationId, date, ['FireSmokeDetected']);
  const unsafe = countEventTypes(organizationId, date, ['UnsafeClimbing']);
  const score = clamp(100 - fall * 25 - fire * 30 - unsafe * 10);
  const drivers: ScoreDriver[] = [
    { key: 'fall', label: 'Fall incidents', impact: -fall * 25, detail: `${fall} event(s)` },
    { key: 'fire', label: 'Fire/smoke signals', impact: -fire * 30, detail: `${fire} event(s)` },
    { key: 'unsafe', label: 'Unsafe movement', impact: -unsafe * 10, detail: `${unsafe} event(s)` },
  ];
  return { score, drivers: drivers.filter((d) => d.impact) };
}

export function computeSecurityScore(organizationId: number, date: string) {
  const restricted = countEventTypes(organizationId, date, ['RestrictedZoneEntry', 'ServerRoomEntry']);
  const score = clamp(100 - restricted * 18);
  const drivers: ScoreDriver[] = [
    { key: 'restricted', label: 'Unauthorized zone entries', impact: -restricted * 18, detail: `${restricted} event(s)` },
  ];
  return { score, drivers: drivers.filter((d) => d.impact) };
}

export function computeTeacherScore(inputs: ScoreInputsBundle) {
  const t = (inputs.teacher ?? {}) as Record<string, unknown>;
  const conducted = num(t.conducted_pct, 90);
  const presence = num(t.presence_pct, 90);
  const onTime = num(t.on_time_pct, 88);
  const activity = num(t.teaching_zone_activity ?? t.teaching_zone_activity_pct, 80);
  const gaps = num(t.gap_count);
  const early = num(t.early_exit_count);
  const score = clamp(conducted * 0.25 + presence * 0.25 + onTime * 0.2 + activity * 0.2 - gaps * 6 - early * 4);
  const drivers: ScoreDriver[] = [
    { key: 'conducted', label: 'Classes conducted', impact: conducted * 0.25 },
    { key: 'presence', label: 'Teacher presence', impact: presence * 0.25 },
    { key: 'gaps', label: 'Supervision gaps', impact: -gaps * 6 },
  ];
  return { score, drivers };
}

export function computeOccupancyScore(inputs: ScoreInputsBundle) {
  const o = (inputs.occupancy ?? {}) as Record<string, unknown>;
  const match = num(o.expected_match ?? o.expected_match_pct, 90);
  const over = num(o.overcrowding_count);
  const under = num(o.underuse_count);
  const empty = num(o.empty_room_count);
  const score = clamp(match - over * 8 - under * 5 - empty * 10);
  const drivers: ScoreDriver[] = [
    { key: 'match', label: 'Expected occupancy match', impact: match * 0.6 },
    { key: 'over', label: 'Overcrowding', impact: -over * 8 },
    { key: 'empty', label: 'Empty scheduled rooms', impact: -empty * 10 },
  ];
  return { score, drivers };
}

export function computeAcademicScore(inputs: ScoreInputsBundle) {
  const c = (inputs.classroom ?? {}) as Record<string, unknown>;
  const conducted = num(c.conducted_pct, 92);
  const late = num(c.late_count);
  const missed = num(c.missed_count);
  const score = clamp(conducted - late * 5 - missed * 12);
  const drivers: ScoreDriver[] = [
    { key: 'conducted', label: 'Periods conducted', impact: conducted * 0.7 },
    { key: 'late', label: 'Late starts', impact: -late * 5 },
    { key: 'missed', label: 'Missed periods', impact: -missed * 12 },
  ];
  return { score, drivers };
}

export function computeStaffScore(inputs: ScoreInputsBundle) {
  const s = (inputs.staff ?? {}) as Record<string, unknown>;
  const coverage = num(s.coverage_pct, 95);
  const gaps = num(s.gap_count, coverage < 100 ? Math.round((100 - coverage) / 25) : 0);
  const score = clamp(coverage - gaps * 15);
  const drivers: ScoreDriver[] = [
    { key: 'coverage', label: 'Roster coverage', impact: coverage * 0.8 },
    { key: 'gaps', label: 'Critical window gaps', impact: -gaps * 15 },
  ];
  return { score, drivers };
}

export function computeSpaceScore(inputs: ScoreInputsBundle) {
  const s = (inputs.space ?? {}) as Record<string, unknown>;
  const util = num(s.avg_utilization_pct, 60);
  const over = num(s.overcrowded_room_count);
  const under = num(s.underused_room_count);
  const score = clamp(util + 20 - over * 10 - under * 6);
  const drivers: ScoreDriver[] = [{ key: 'util', label: 'Average utilization', impact: util * 0.5 }];
  return { score, drivers };
}

export function computeDisciplineScore(inputs: ScoreInputsBundle) {
  const d = (inputs.discipline ?? {}) as Record<string, unknown>;
  const running = num(d.running_count);
  const loiter = num(d.loitering_count);
  const unsafe = num(d.unsafe_count);
  const crowd = num(d.crowding_count);
  const score = clamp(100 - running * 8 - loiter * 5 - unsafe * 12 - crowd * 6);
  const drivers: ScoreDriver[] = [
    { key: 'running', label: 'Running incidents', impact: -running * 8 },
    { key: 'loiter', label: 'Loitering', impact: -loiter * 5 },
  ];
  return { score, drivers };
}

export function computeParentScore(inputs: ScoreInputsBundle) {
  const p = (inputs.parent ?? {}) as Record<string, unknown>;
  const smooth = num(p.arrival_smooth_score, 90);
  const dispersal = num(p.dispersal_congestion_min);
  const overlap = num(p.overlap_count);
  const delay = num(p.delay_min);
  const score = clamp(smooth * 0.5 + (100 - dispersal * 2) * 0.3 - overlap * 8 - delay * 2);
  const drivers: ScoreDriver[] = [
    { key: 'smooth', label: 'Arrival smoothness', impact: smooth * 0.3 },
    { key: 'dispersal', label: 'Dispersal congestion', impact: -dispersal * 2, metricKey: 'gate_congestion' },
  ];
  return { score, drivers };
}

export function computeComplianceScore(inputs: ScoreInputsBundle) {
  const c = (inputs.compliance ?? {}) as Record<string, unknown>;
  const violations = num(c.violation_count);
  const offline = num(c.camera_offline_count);
  const gaps = num(c.supervision_gap_count);
  const score = clamp(100 - violations * 10 - offline * 12 - gaps * 8);
  const drivers: ScoreDriver[] = [
    { key: 'violations', label: 'Compliance violations', impact: -violations * 10 },
    { key: 'offline', label: 'Critical camera offline', impact: -offline * 12 },
  ];
  return { score, drivers };
}

export function computeAllModuleScores(
  organizationId: number,
  date: string,
  inputs: ScoreInputsBundle
): Record<ScoreModuleKey, { score: number; drivers: ScoreDriver[] }> {
  return {
    safety: computeSafetyScore(organizationId, date, inputs),
    security: computeSecurityScore(organizationId, date),
    teacher: computeTeacherScore(inputs),
    occupancy: computeOccupancyScore(inputs),
    academic: computeAcademicScore(inputs),
    staff: computeStaffScore(inputs),
    space: computeSpaceScore(inputs),
    discipline: computeDisciplineScore(inputs),
    parent: computeParentScore(inputs),
    compliance: computeComplianceScore(inputs),
  };
}

export function computeOverallScore(
  modules: Record<ScoreModuleKey, { score: number }>,
  weights: Record<ScoreModuleKey, number>
) {
  let total = 0;
  let weightSum = 0;
  for (const key of Object.keys(weights) as ScoreModuleKey[]) {
    const w = weights[key] ?? 0;
    if (!w) continue;
    total += modules[key].score * w;
    weightSum += w;
  }
  if (!weightSum) return 0;
  return clamp(total / weightSum);
}
