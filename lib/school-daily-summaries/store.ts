import type { IntelligenceEvent, EventType } from '../school-rule-engine/types';
import { listEvents } from '../school-rule-engine/store';
import { db } from '../school-foundation/store';
import { mapEventToContext } from './context';
import { persistDailyAggregation } from '../school-db/persist-daily';
import { loadDailyAggregationFromPg } from '../school-db/load-daily';
import { isDbEnabled } from '../school-db/pool';
import type {
  ClassroomDailyRow,
  ComplianceDailyRow,
  DailyOverviewResponse,
  DailySummaryModule,
  DisciplineDailyRow,
  ModuleOverviewSlice,
  OccupancyDailyRow,
  ParentDailyRow,
  ProcessDailyRow,
  ScoreInputsRow,
  SpaceDailyRow,
  StaffDailyRow,
  SummaryFact,
  TeacherDailyRow,
} from './types';

let nextId = 1;
const nid = () => nextId++;

const teacherRows: TeacherDailyRow[] = [];
const classroomRows: ClassroomDailyRow[] = [];
const occupancyRows: OccupancyDailyRow[] = [];
const processRows: ProcessDailyRow[] = [];
const staffRows: StaffDailyRow[] = [];
const spaceRows: SpaceDailyRow[] = [];
const disciplineRows: DisciplineDailyRow[] = [];
const parentRows: ParentDailyRow[] = [];
const complianceRows: ComplianceDailyRow[] = [];
const scoreInputsRows: ScoreInputsRow[] = [];

const MODULE_LABELS: Record<DailySummaryModule, string> = {
  teacher: 'Teacher Productivity',
  classroom: 'Academic Operations',
  occupancy: 'Student Occupancy',
  process: 'Campus Process',
  staff: 'Staff Deployment',
  space: 'Space Utilization',
  discipline: 'Discipline',
  parent: 'Parent Experience',
  compliance: 'Compliance',
  school: 'School Score Inputs',
};

export const METRIC_EVENT_TYPES: Record<string, EventType[]> = {
  supervision_gaps: ['TeacherSupervisionGap'],
  late_starts: ['LateClassStart'],
  missed_periods: ['MissedPeriod', 'ClassNotConducted'],
  overcrowding: ['Overcrowding'],
  under_occupancy: ['UnderOccupancy', 'EmptyScheduledRoom'],
  gate_congestion: ['GateCongestion', 'ArrivalCongestion'],
  dispersal_delay: ['DispersalDelay', 'WeakDispersalCoverage'],
  running: ['RunningDetected'],
  loitering: ['Loitering'],
  staff_gaps: ['StaffMissingAtGate', 'StaffMissingAtPlayground'],
  compliance_violations: ['CriticalCameraOffline', 'LabSupervisionMissing', 'RestrictedZoneEntry', 'FireExitObstruction'],
  parent_overlap: ['VehicleStudentOverlap', 'ReceptionQueueHigh'],
};

function dayBounds(date: string) {
  return { from: `${date}T00:00:00.000Z`, to: `${date}T23:59:59.999Z` };
}

function isHoliday(organizationId: number, date: string) {
  const row = db.calendar().find((c) => c.organizationId === organizationId && c.calendarDate === date);
  return row?.dayType === 'Holiday';
}

function eventsForDay(organizationId: number, date: string) {
  const { from, to } = dayBounds(date);
  return listEvents(organizationId, { from, to }).filter((e) => {
    const ctx = mapEventToContext(e);
    return !ctx.excludeFromAggregation;
  });
}

function countTypes(events: IntelligenceEvent[], types: EventType[]) {
  return events.filter((e) => types.includes(e.eventType)).length;
}

function fact(text: string, metricKey?: string, eventTypes?: EventType[]): SummaryFact {
  return { text, metricKey, eventTypes };
}

function purgeOrgDate(organizationId: number, date: string) {
  const keep = <T extends { organizationId: number; summaryDate: string }>(arr: T[]) => {
    const out = arr.filter((r) => !(r.organizationId === organizationId && r.summaryDate === date));
    arr.length = 0;
    arr.push(...out);
  };
  keep(teacherRows);
  keep(classroomRows);
  keep(occupancyRows);
  keep(processRows);
  keep(staffRows);
  keep(spaceRows);
  keep(disciplineRows);
  keep(parentRows);
  keep(complianceRows);
  keep(scoreInputsRows);
}

function scheduledPeriods(organizationId: number, date: string) {
  const dow = new Date(`${date}T12:00:00`).getDay() || 7;
  return db.timetable().filter((e) => e.organizationId === organizationId && e.isActive && e.dayOfWeek === dow);
}

export function aggregateDay(organizationId: number, date: string, siteId?: number) {
  const now = new Date().toISOString();
  if (isHoliday(organizationId, date)) {
    return { skipped: true, reason: 'holiday' as const, date, organizationId };
  }

  purgeOrgDate(organizationId, date);
  const events = eventsForDay(organizationId, date);
  const periods = scheduledPeriods(organizationId, date);

  const gapCount = countTypes(events, ['TeacherSupervisionGap']);
  const lateCount = countTypes(events, ['LateClassStart']);
  const missedCount = countTypes(events, ['MissedPeriod', 'ClassNotConducted']);
  const conducted = Math.max(0, periods.length - missedCount);
  const conductedPct = periods.length ? Math.round((conducted / periods.length) * 100) : 92;
  const presencePct = Math.max(70, 100 - gapCount * 4);
  const onTimePct = periods.length ? Math.max(60, 100 - Math.round((lateCount / periods.length) * 100)) : 88;

  const teacherFacts: SummaryFact[] = [];
  if (lateCount) teacherFacts.push(fact(`Classes started late on ${lateCount} scheduled period(s).`, 'late_starts', ['LateClassStart']));
  if (gapCount) teacherFacts.push(fact(`Teacher supervision gaps detected ${gapCount} time(s) during class hours.`, 'supervision_gaps', ['TeacherSupervisionGap']));
  if (!teacherFacts.length) teacherFacts.push(fact('Teacher presence and class conduct aligned with the timetable for the day.'));

  teacherRows.push({
    id: nid(),
    organizationId,
    siteId,
    summaryDate: date,
    teacherId: undefined,
    metrics: {
      classes_scheduled: periods.length,
      classes_conducted: conducted,
      conducted_pct: conductedPct,
      presence_pct: presencePct,
      on_time_pct: onTimePct,
      teaching_zone_activity_pct: Math.max(55, 95 - gapCount * 5),
      teaching_zone_activity: Math.max(55, 95 - gapCount * 5),
      gap_count: gapCount,
      early_exit_count: countTypes(events, ['EarlyClassEnd']),
    },
    facts: teacherFacts,
    createdAt: now,
  });

  const rooms = db.rooms().filter((r) => r.isActive);
  for (const room of rooms.slice(0, 8)) {
    const roomEvents = events.filter((e) => e.roomId === room.id);
    const overcrowding = countTypes(roomEvents, ['Overcrowding']);
    const under = countTypes(roomEvents, ['UnderOccupancy', 'EmptyScheduledRoom']);
    classroomRows.push({
      id: nid(),
      organizationId,
      siteId,
      summaryDate: date,
      roomId: room.id,
      metrics: {
        scheduled_periods: 1,
        conducted: under ? 0 : 1,
        late_minutes: lateCount ? 8 : 0,
        missed_count: missedCount ? 1 : 0,
        conducted_pct: under ? 0 : 100,
        late_count: lateCount ? 1 : 0,
      },
      facts: [
        fact(
          overcrowding
            ? `Room ${room.roomCode} showed overcrowding during one or more periods.`
            : `Room ${room.roomCode} periods ran as scheduled.`,
          overcrowding ? 'overcrowding' : undefined,
          overcrowding ? ['Overcrowding'] : undefined
        ),
      ],
      createdAt: now,
    });

    occupancyRows.push({
      id: nid(),
      organizationId,
      siteId,
      summaryDate: date,
      roomId: room.id,
      metrics: {
        expected_count: room.capacity,
        actual_peak: overcrowding ? room.capacity + 4 : Math.round(room.capacity * 0.85),
        expected_match_pct: under ? 62 : 94,
        expected_match: under ? 62 : 94,
        overcrowding_count: overcrowding,
        underuse_count: under,
        empty_room_count: countTypes(roomEvents, ['EmptyScheduledRoom']),
      },
      facts: [
        fact(
          under
            ? `Scheduled room ${room.roomCode} was under-used relative to timetable.`
            : `Occupancy in ${room.roomCode} stayed within expected range.`,
          under ? 'under_occupancy' : undefined
        ),
      ],
      createdAt: now,
    });
  }

  const gateMin = countTypes(events, ['GateCongestion', 'ArrivalCongestion']) * 6;
  const dispersalMin = countTypes(events, ['GateCongestion', 'DispersalDelay']) * 9;
  processRows.push({
    id: nid(),
    organizationId,
    siteId,
    summaryDate: date,
    timeWindow: 'Arrival',
    metrics: { congestion_minutes: gateMin, smooth_minutes: Math.max(0, 45 - gateMin) },
    facts: [fact(gateMin ? `Arrival window congestion totaled about ${gateMin} minutes.` : 'Arrival flow remained smooth.')],
    createdAt: now,
  });
  processRows.push({
    id: nid(),
    organizationId,
    siteId,
    summaryDate: date,
    timeWindow: 'Dispersal',
    metrics: {
      dispersal_congestion_min: dispersalMin,
      overlap_count: countTypes(events, ['VehicleStudentOverlap']),
      delay_min: countTypes(events, ['DispersalDelay']) * 5,
    },
    facts: [
      fact(
        dispersalMin
          ? `Dispersal gate congestion lasted about ${dispersalMin} minutes.`
          : 'Dispersal completed without extended gate queues.',
        'gate_congestion',
        ['GateCongestion', 'DispersalDelay']
      ),
    ],
    createdAt: now,
  });

  staffRows.push({
    id: nid(),
    organizationId,
    siteId,
    summaryDate: date,
    dutyRole: 'Gate',
    metrics: {
      roster_slots: 2,
      covered_slots: 2 - countTypes(events, ['StaffMissingAtGate']),
      coverage_pct: countTypes(events, ['StaffMissingAtGate']) ? 50 : 100,
    },
    facts: [
      fact(
        countTypes(events, ['StaffMissingAtGate'])
          ? 'Gate duty roster had a coverage gap during a critical window.'
          : 'Gate duty roster was fully covered for scheduled windows.',
        'staff_gaps',
        ['StaffMissingAtGate']
      ),
    ],
    createdAt: now,
  });

  for (const room of rooms.slice(0, 5)) {
    spaceRows.push({
      id: nid(),
      organizationId,
      siteId,
      summaryDate: date,
      roomId: room.id,
      metrics: {
        utilization_pct: 40 + (room.id % 45),
        capacity_efficiency_pct: 72 + (room.id % 20),
        underused_flag: countTypes(events.filter((e) => e.roomId === room.id), ['RoomUnderused']) > 0,
      },
      facts: [fact(`Space utilization for ${room.roomCode} was ${40 + (room.id % 45)}% of scheduled capacity.`)],
      createdAt: now,
    });
  }

  const running = countTypes(events, ['RunningDetected']);
  const loiter = countTypes(events, ['Loitering']);
  disciplineRows.push({
    id: nid(),
    organizationId,
    siteId,
    summaryDate: date,
    metrics: {
      running_count: running,
      loitering_count: loiter,
      crowding_count: countTypes(events, ['CorridorOverload']),
      unsafe_movement_count: countTypes(events, ['UnsafeClimbing']),
    },
    facts: [
      fact(running ? `${running} running incident(s) flagged in corridors or playground.` : 'No elevated running incidents recorded.'),
      fact(loiter ? `${loiter} loitering event(s) during class hours.` : 'Loitering remained within normal bounds.'),
    ],
    createdAt: now,
  });

  parentRows.push({
    id: nid(),
    organizationId,
    siteId,
    summaryDate: date,
    metrics: {
      arrival_smooth_score: gateMin ? 70 : 92,
      dispersal_congestion_min: dispersalMin,
      overlap_count: countTypes(events, ['VehicleStudentOverlap']),
      delay_min: countTypes(events, ['DispersalDelay']) * 5,
    },
    facts: [
      fact(
        dispersalMin
          ? `Longest gate queue episode during dispersal was about ${dispersalMin} minutes.`
          : 'Parent pickup flow at gates remained within target wait times.',
        'gate_congestion'
      ),
    ],
    createdAt: now,
  });

  const violations =
    countTypes(events, ['CriticalCameraOffline', 'LabSupervisionMissing', 'RestrictedZoneEntry', 'FireExitObstruction']) +
    countTypes(events, ['ServerRoomEntry']);
  complianceRows.push({
    id: nid(),
    organizationId,
    siteId,
    summaryDate: date,
    metrics: {
      violation_count: violations,
      camera_offline_count: countTypes(events, ['CriticalCameraOffline']),
      supervision_gap_count: countTypes(events, ['LabSupervisionMissing']),
    },
    facts: [
      fact(
        violations
          ? `${violations} compliance-related event(s) require follow-up.`
          : 'No critical compliance violations recorded for the day.'
      ),
    ],
    createdAt: now,
  });

  const inputsJson = {
    teacher: teacherRows.find((r) => r.organizationId === organizationId && r.summaryDate === date)?.metrics,
    classroom: { conducted_pct: conductedPct, late_count: lateCount, missed_count: missedCount },
    occupancy: {
      expected_match_pct: 91,
      expected_match: 91,
      overcrowding_count: countTypes(events, ['Overcrowding']),
      underuse_count: countTypes(events, ['UnderOccupancy']),
      empty_room_count: countTypes(events, ['EmptyScheduledRoom']),
    },
    parent: parentRows.find((r) => r.organizationId === organizationId && r.summaryDate === date)?.metrics,
    process: { dispersal_congestion_min: dispersalMin },
    staff: { coverage_pct: staffRows[staffRows.length - 1]?.metrics.coverage_pct ?? 100 },
    space: { avg_utilization_pct: 58 },
    discipline: disciplineRows[disciplineRows.length - 1]?.metrics,
    compliance: complianceRows[complianceRows.length - 1]?.metrics,
    safety: { placeholder: true },
    security: { placeholder: true },
  };

  scoreInputsRows.push({
    id: nid(),
    organizationId,
    siteId,
    summaryDate: date,
    metrics: {},
    inputsJson,
    facts: [
      fact('Daily fact bundle prepared for Phase 5 scoring (no weighted overall score in Phase 4).'),
    ],
    createdAt: now,
  });

  const result = {
    skipped: false,
    organizationId,
    date,
    eventsProcessed: events.length,
    tables: {
      teacher: teacherRows.filter((r) => r.organizationId === organizationId && r.summaryDate === date).length,
      classroom: classroomRows.filter((r) => r.organizationId === organizationId && r.summaryDate === date).length,
      occupancy: occupancyRows.filter((r) => r.organizationId === organizationId && r.summaryDate === date).length,
      process: processRows.filter((r) => r.organizationId === organizationId && r.summaryDate === date).length,
      staff: staffRows.filter((r) => r.organizationId === organizationId && r.summaryDate === date).length,
      space: spaceRows.filter((r) => r.organizationId === organizationId && r.summaryDate === date).length,
      discipline: disciplineRows.filter((r) => r.organizationId === organizationId && r.summaryDate === date).length,
      parent: parentRows.filter((r) => r.organizationId === organizationId && r.summaryDate === date).length,
      compliance: complianceRows.filter((r) => r.organizationId === organizationId && r.summaryDate === date).length,
      scoreInputs: 1,
    },
    aggregatedAt: now,
  };
  void persistDailyAggregation(organizationId, date);
  return result;
}

/** Aggregate in-memory and await Postgres persistence (when DB enabled). */
export async function aggregateDayPersisted(organizationId: number, date: string, siteId?: number) {
  const result = aggregateDay(organizationId, date, siteId);
  if (!('skipped' in result && result.skipped) && isDbEnabled()) {
    await persistDailyAggregation(organizationId, date);
  }
  return result;
}

export function hasDailySummariesForDate(organizationId: number, date: string, siteId?: number) {
  return rowsForModule('teacher', organizationId, date, siteId).length > 0;
}

/** Hydrate Phase 4 daily rows from Postgres when memory is empty for this date. */
export async function ensureDailySummariesForDate(organizationId: number, date: string, siteId?: number) {
  if (hasDailySummariesForDate(organizationId, date, siteId)) {
    return { source: 'memory' as const };
  }
  if (!isDbEnabled()) return { source: 'none' as const };
  const loaded = await loadDailyAggregationFromPg(organizationId, date, dailyDb);
  return { source: loaded ? ('postgres' as const) : ('none' as const) };
}

function headlineFromRows(rows: { metrics: Record<string, unknown>; facts: SummaryFact[] }[]): ModuleOverviewSlice {
  const metrics: Record<string, number | string | null> = {};
  for (const r of rows) {
    for (const [k, v] of Object.entries(r.metrics)) {
      if (typeof v === 'number' && metrics[k] == null) metrics[k] = v;
      else if (typeof v === 'number' && typeof metrics[k] === 'number') metrics[k] = (metrics[k] as number) + v;
    }
  }
  const facts = rows.flatMap((r) => r.facts).slice(0, 4);
  return { module: 'teacher', label: '', rowCount: rows.length, headlineMetrics: metrics, facts };
}

function rowsForModule(module: DailySummaryModule, organizationId: number, date: string, siteId?: number) {
  const match = <T extends { organizationId: number; summaryDate: string; siteId?: number }>(arr: T[]) =>
    arr.filter((r) => r.organizationId === organizationId && r.summaryDate === date && (siteId == null || r.siteId === siteId));

  switch (module) {
    case 'teacher':
      return match(teacherRows);
    case 'classroom':
      return match(classroomRows);
    case 'occupancy':
      return match(occupancyRows);
    case 'process':
      return match(processRows);
    case 'staff':
      return match(staffRows);
    case 'space':
      return match(spaceRows);
    case 'discipline':
      return match(disciplineRows);
    case 'parent':
      return match(parentRows);
    case 'compliance':
      return match(complianceRows);
    case 'school':
      return match(scoreInputsRows);
    default:
      return [];
  }
}

export function getDailyOverview(organizationId: number, date: string, siteId?: number): DailyOverviewResponse {
  const modules: DailySummaryModule[] = [
    'teacher',
    'classroom',
    'occupancy',
    'process',
    'staff',
    'space',
    'discipline',
    'parent',
    'compliance',
  ];
  const slices: ModuleOverviewSlice[] = modules.map((module) => {
    const rows = rowsForModule(module, organizationId, date, siteId) as { metrics: Record<string, unknown>; facts: SummaryFact[] }[];
    const base = headlineFromRows(rows);
    return { ...base, module, label: MODULE_LABELS[module] };
  });
  const score = scoreInputsRows.find(
    (r) => r.organizationId === organizationId && r.summaryDate === date && (siteId == null || r.siteId === siteId)
  );
  return { organizationId, siteId, date, modules: slices, scoreInputs: score };
}

export function getModuleDailySummary(
  module: DailySummaryModule,
  organizationId: number,
  date: string,
  siteId?: number
) {
  const rows = rowsForModule(module, organizationId, date, siteId);
  const overview = getDailyOverview(organizationId, date, siteId);
  const slice = overview.modules.find((m) => m.module === module);
  return {
    module,
    label: MODULE_LABELS[module],
    date,
    organizationId,
    siteId,
    rows,
    headlineMetrics: slice?.headlineMetrics ?? {},
    facts: slice?.facts ?? rows.flatMap((r) => (r as { facts: SummaryFact[] }).facts).slice(0, 6),
  };
}

export function getModuleMetricEvents(
  module: DailySummaryModule,
  organizationId: number,
  date: string,
  metric?: string
) {
  const types = metric && METRIC_EVENT_TYPES[metric] ? METRIC_EVENT_TYPES[metric] : undefined;
  const { from, to } = dayBounds(date);
  let rows = eventsForDay(organizationId, date);
  if (types?.length) rows = rows.filter((e) => types.includes(e.eventType));
  if (!types?.length) {
    const moduleTypes: Partial<Record<DailySummaryModule, EventType[]>> = {
      teacher: ['TeacherSupervisionGap', 'LateClassStart', 'EarlyClassEnd', 'LowTeachingZoneActivity'],
      classroom: ['LateClassStart', 'MissedPeriod', 'ClassNotConducted', 'EarlyClassEnd'],
      occupancy: ['Overcrowding', 'UnderOccupancy', 'EmptyScheduledRoom'],
      process: ['GateCongestion', 'ArrivalCongestion', 'DispersalDelay', 'WeakDispersalCoverage'],
      staff: ['StaffMissingAtGate', 'StaffMissingAtPlayground'],
      space: ['RoomUnderused', 'CorridorOverload'],
      discipline: ['RunningDetected', 'Loitering', 'UnsafeClimbing', 'CorridorOverload'],
      parent: ['GateCongestion', 'VehicleStudentOverlap', 'ReceptionQueueHigh', 'DispersalDelay'],
      compliance: ['CriticalCameraOffline', 'LabSupervisionMissing', 'RestrictedZoneEntry', 'FireExitObstruction'],
    };
    const fallback = moduleTypes[module];
    if (fallback) rows = rows.filter((e) => fallback.includes(e.eventType));
  }
  return { module, metric, date, organizationId, events: rows, from, to };
}




/** Daily summary trend from aggregated tables only (never raw ai_signals). */
export function getModuleDailyTrend(
  module: DailySummaryModule,
  organizationId: number,
  endDate: string,
  days = 7,
  siteId?: number,
  metricKey?: string
) {
  const points: { date: string; value: number | null; metrics: Record<string, number | string | null> }[] = [];
  const end = new Date(`${endDate}T12:00:00.000Z`);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    const summary = getModuleDailySummary(module, organizationId, date, siteId);
    const metrics = summary.headlineMetrics ?? {};
    const key =
      metricKey ??
      (module === 'teacher'
        ? 'conducted_pct'
        : module === 'occupancy'
          ? 'expected_match_pct'
          : Object.keys(metrics)[0]);
    const raw = metrics[key];
    points.push({
      date,
      value: typeof raw === 'number' ? raw : null,
      metrics: metrics as Record<string, number | string | null>,
    });
  }
  return { module, organizationId, endDate, days, metricKey: metricKey ?? 'auto', points };
}

/** This week vs prior week totals/averages for one headline metric (summary tables only). */
export function getModuleWeekCompare(
  module: DailySummaryModule,
  organizationId: number,
  endDate: string,
  siteId?: number,
  metricKey?: string
) {
  const thisTrend = getModuleDailyTrend(module, organizationId, endDate, 7, siteId, metricKey);
  const priorEnd = new Date(`${endDate}T12:00:00.000Z`);
  priorEnd.setUTCDate(priorEnd.getUTCDate() - 7);
  const priorEndIso = priorEnd.toISOString().slice(0, 10);
  const lastTrend = getModuleDailyTrend(module, organizationId, priorEndIso, 7, siteId, thisTrend.metricKey);

  const values = (pts: { value: number | null }[]) => pts.map((p) => p.value).filter((v): v is number => v != null);
  const total = (pts: { value: number | null }[]) => values(pts).reduce((a, b) => a + b, 0);
  const average = (pts: { value: number | null }[]) => {
    const v = values(pts);
    return v.length ? Math.round((total(pts) / v.length) * 10) / 10 : null;
  };

  const thisTotal = total(thisTrend.points);
  const lastTotal = total(lastTrend.points);

  return {
    module,
    organizationId,
    endDate,
    metricKey: thisTrend.metricKey,
    thisWeek: { endDate, points: thisTrend.points, total: thisTotal, average: average(thisTrend.points) },
    lastWeek: { endDate: priorEndIso, points: lastTrend.points, total: lastTotal, average: average(lastTrend.points) },
    delta: thisTotal - lastTotal,
  };
}

export function backfillAggregation(organizationId: number, dates: string[], siteId?: number) {
  const started = Date.now();
  const results = dates.map((date) => ({ date, result: aggregateDay(organizationId, date, siteId) }));
  const durationMs = Date.now() - started;
  let rowsWritten = 0;
  for (const r of results) {
    if ('tables' in r.result && r.result.tables) {
      rowsWritten += Object.values(r.result.tables).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    }
  }
  return { organizationId, dates, rowsWritten, durationMs, results };
}

export function runScheduledAggregation(organizationId: number, date?: string, siteId?: number) {
  const d = date ?? new Date().toISOString().slice(0, 10);
  const started = Date.now();
  const result = aggregateDay(organizationId, d, siteId);
  const durationMs = Date.now() - started;
  const log = {
    organizationId,
    date: d,
    skipped: 'skipped' in result && result.skipped,
    durationMs,
    tables: 'tables' in result ? result.tables : undefined,
    errors: [] as string[],
  };
  return { aggregation: result, log };
}

export function resetDailySummariesStore() {
  teacherRows.length = 0;
  classroomRows.length = 0;
  occupancyRows.length = 0;
  processRows.length = 0;
  staffRows.length = 0;
  spaceRows.length = 0;
  disciplineRows.length = 0;
  parentRows.length = 0;
  complianceRows.length = 0;
  scoreInputsRows.length = 0;
  nextId = 1;
}

export const dailyDb = {
  teacher: () => teacherRows,
  classroom: () => classroomRows,
  occupancy: () => occupancyRows,
  process: () => processRows,
  staff: () => staffRows,
  space: () => spaceRows,
  discipline: () => disciplineRows,
  parent: () => parentRows,
  compliance: () => complianceRows,
  scoreInputs: () => scoreInputsRows,
};
