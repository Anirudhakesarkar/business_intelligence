import type {
  ClassroomDailyRow,
  ComplianceDailyRow,
  DisciplineDailyRow,
  OccupancyDailyRow,
  ParentDailyRow,
  ProcessDailyRow,
  ScoreInputsRow,
  SpaceDailyRow,
  StaffDailyRow,
  SummaryFact,
  TeacherDailyRow,
} from '../school-daily-summaries/types';
import { dbQuery, isDbEnabled } from './pool';

function parseJson<T>(v: unknown): T {
  if (typeof v === 'string') return JSON.parse(v) as T;
  return (v ?? {}) as T;
}

function formatPgDate(v: unknown): string {
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}

function baseFromPg(r: {
  id: string | number;
  organization_id: string | number;
  site_id: string | number | null;
  summary_date: string | Date;
  metrics: unknown;
  facts: unknown;
  created_at?: string | Date;
}) {
  const summaryDate = formatPgDate(r.summary_date);
  return {
    id: Number(r.id),
    organizationId: Number(r.organization_id),
    siteId: r.site_id != null ? Number(r.site_id) : undefined,
    summaryDate,
    metrics: parseJson<TeacherDailyRow['metrics']>(r.metrics),
    facts: parseJson<SummaryFact[]>(r.facts),
    createdAt:
      r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? new Date().toISOString()),
  };
}

function mergeRows<T extends { organizationId: number; summaryDate: string; id: number }>(
  target: T[],
  incoming: T[],
  organizationId: number,
  date: string,
) {
  const kept = target.filter((r) => !(r.organizationId === organizationId && r.summaryDate === date));
  target.length = 0;
  target.push(...kept, ...incoming);
  let maxId = 0;
  for (const r of target) if (r.id > maxId) maxId = r.id;
  return maxId;
}

type DailyDb = {
  teacher: () => TeacherDailyRow[];
  classroom: () => ClassroomDailyRow[];
  occupancy: () => OccupancyDailyRow[];
  process: () => ProcessDailyRow[];
  staff: () => StaffDailyRow[];
  space: () => SpaceDailyRow[];
  discipline: () => DisciplineDailyRow[];
  parent: () => ParentDailyRow[];
  compliance: () => ComplianceDailyRow[];
  scoreInputs: () => ScoreInputsRow[];
};

/** Load persisted daily summary rows for a date into the in-memory Phase 4 store. */
export async function loadDailyAggregationFromPg(
  organizationId: number,
  date: string,
  dailyDb: DailyDb,
): Promise<boolean> {
  if (!isDbEnabled()) return false;

  const teacherR = await dbQuery<{
    id: string | number;
    organization_id: string | number;
    site_id: string | number | null;
    summary_date: string | Date;
    teacher_id: string | number | null;
    metrics: unknown;
    facts: unknown;
    created_at?: string | Date;
  }>(
    `SELECT id, organization_id, site_id, summary_date, teacher_id, metrics, facts, created_at
     FROM school_teacher_daily_intelligence WHERE organization_id = $1 AND summary_date = $2`,
    [organizationId, date],
  );
  const teacherRows = teacherR?.rows ?? [];

  const teacher: TeacherDailyRow[] = teacherRows.map((r) => ({
    ...baseFromPg(r),
    teacherId: r.teacher_id != null ? Number(r.teacher_id) : undefined,
  }));

  const classroomR = await dbQuery<{
    id: string | number;
    organization_id: string | number;
    site_id: string | number | null;
    summary_date: string | Date;
    room_id: string | number | null;
    class_id: string | number | null;
    section_id: string | number | null;
    metrics: unknown;
    facts: unknown;
    created_at?: string | Date;
  }>(
    `SELECT id, organization_id, site_id, summary_date, room_id, class_id, section_id, metrics, facts, created_at
     FROM school_classroom_daily_intelligence WHERE organization_id = $1 AND summary_date = $2`,
    [organizationId, date],
  );
  const classroom: ClassroomDailyRow[] = (classroomR?.rows ?? []).map((r) => ({
    ...baseFromPg(r),
    roomId: r.room_id != null ? Number(r.room_id) : undefined,
    classId: r.class_id != null ? Number(r.class_id) : undefined,
    sectionId: r.section_id != null ? Number(r.section_id) : undefined,
  }));

  const occupancyR = await dbQuery<{
    id: string | number;
    organization_id: string | number;
    site_id: string | number | null;
    summary_date: string | Date;
    room_id: string | number | null;
    zone_id: string | number | null;
    metrics: unknown;
    facts: unknown;
    created_at?: string | Date;
  }>(
    `SELECT id, organization_id, site_id, summary_date, room_id, zone_id, metrics, facts, created_at
     FROM school_student_occupancy_daily WHERE organization_id = $1 AND summary_date = $2`,
    [organizationId, date],
  );
  const occupancy: OccupancyDailyRow[] = (occupancyR?.rows ?? []).map((r) => ({
    ...baseFromPg(r),
    roomId: r.room_id != null ? Number(r.room_id) : undefined,
    zoneId: r.zone_id != null ? Number(r.zone_id) : undefined,
  }));

  const processR = await dbQuery<{
    id: string | number;
    organization_id: string | number;
    site_id: string | number | null;
    summary_date: string | Date;
    time_window: string | null;
    metrics: unknown;
    facts: unknown;
    created_at?: string | Date;
  }>(
    `SELECT id, organization_id, site_id, summary_date, time_window, metrics, facts, created_at
     FROM school_process_daily_intelligence WHERE organization_id = $1 AND summary_date = $2`,
    [organizationId, date],
  );
  const process: ProcessDailyRow[] = (processR?.rows ?? []).map((r) => ({
    ...baseFromPg(r),
    timeWindow: r.time_window ?? undefined,
  }));

  const staffR = await dbQuery<{
    id: string | number;
    organization_id: string | number;
    site_id: string | number | null;
    summary_date: string | Date;
    zone_id: string | number | null;
    duty_role: string | null;
    metrics: unknown;
    facts: unknown;
    created_at?: string | Date;
  }>(
    `SELECT id, organization_id, site_id, summary_date, zone_id, duty_role, metrics, facts, created_at
     FROM school_staff_deployment_daily WHERE organization_id = $1 AND summary_date = $2`,
    [organizationId, date],
  );
  const staff: StaffDailyRow[] = (staffR?.rows ?? []).map((r) => ({
    ...baseFromPg(r),
    zoneId: r.zone_id != null ? Number(r.zone_id) : undefined,
    dutyRole: r.duty_role ?? undefined,
  }));

  const spaceR = await dbQuery<{
    id: string | number;
    organization_id: string | number;
    site_id: string | number | null;
    summary_date: string | Date;
    room_id: string | number | null;
    metrics: unknown;
    facts: unknown;
    created_at?: string | Date;
  }>(
    `SELECT id, organization_id, site_id, summary_date, room_id, metrics, facts, created_at
     FROM school_space_utilization_daily WHERE organization_id = $1 AND summary_date = $2`,
    [organizationId, date],
  );
  const space: SpaceDailyRow[] = (spaceR?.rows ?? []).map((r) => ({
    ...baseFromPg(r),
    roomId: r.room_id != null ? Number(r.room_id) : undefined,
  }));

  const disciplineR = await dbQuery<{
    id: string | number;
    organization_id: string | number;
    site_id: string | number | null;
    summary_date: string | Date;
    zone_id: string | number | null;
    metrics: unknown;
    facts: unknown;
    created_at?: string | Date;
  }>(
    `SELECT id, organization_id, site_id, summary_date, zone_id, metrics, facts, created_at
     FROM school_discipline_daily_intelligence WHERE organization_id = $1 AND summary_date = $2`,
    [organizationId, date],
  );
  const discipline: DisciplineDailyRow[] = (disciplineR?.rows ?? []).map((r) => ({
    ...baseFromPg(r),
    zoneId: r.zone_id != null ? Number(r.zone_id) : undefined,
  }));

  const parentR = await dbQuery<{
    id: string | number;
    organization_id: string | number;
    site_id: string | number | null;
    summary_date: string | Date;
    metrics: unknown;
    facts: unknown;
    created_at?: string | Date;
  }>(
    `SELECT id, organization_id, site_id, summary_date, metrics, facts, created_at
     FROM school_parent_experience_daily WHERE organization_id = $1 AND summary_date = $2`,
    [organizationId, date],
  );
  const parent: ParentDailyRow[] = (parentR?.rows ?? []).map((r) => baseFromPg(r));

  const complianceR = await dbQuery<{
    id: string | number;
    organization_id: string | number;
    site_id: string | number | null;
    summary_date: string | Date;
    metrics: unknown;
    facts: unknown;
    created_at?: string | Date;
  }>(
    `SELECT id, organization_id, site_id, summary_date, metrics, facts, created_at
     FROM school_compliance_daily_intelligence WHERE organization_id = $1 AND summary_date = $2`,
    [organizationId, date],
  );
  const compliance: ComplianceDailyRow[] = (complianceR?.rows ?? []).map((r) => baseFromPg(r));

  const scoreR = await dbQuery<{
    id: string | number;
    organization_id: string | number;
    site_id: string | number | null;
    summary_date: string | Date;
    inputs_json: unknown;
    facts: unknown;
    created_at?: string | Date;
  }>(
    `SELECT id, organization_id, site_id, summary_date, inputs_json, facts, created_at
     FROM school_daily_score_inputs WHERE organization_id = $1 AND summary_date = $2`,
    [organizationId, date],
  );
  const scoreInputs: ScoreInputsRow[] = (scoreR?.rows ?? []).map((row) => ({
    ...baseFromPg({ ...row, metrics: {} }),
    metrics: {},
    inputsJson: parseJson<ScoreInputsRow['inputsJson']>(row.inputs_json),
  }));

  mergeRows(dailyDb.teacher(), teacher, organizationId, date);
  mergeRows(dailyDb.classroom(), classroom, organizationId, date);
  mergeRows(dailyDb.occupancy(), occupancy, organizationId, date);
  mergeRows(dailyDb.process(), process, organizationId, date);
  mergeRows(dailyDb.staff(), staff, organizationId, date);
  mergeRows(dailyDb.space(), space, organizationId, date);
  mergeRows(dailyDb.discipline(), discipline, organizationId, date);
  mergeRows(dailyDb.parent(), parent, organizationId, date);
  mergeRows(dailyDb.compliance(), compliance, organizationId, date);
  mergeRows(dailyDb.scoreInputs(), scoreInputs, organizationId, date);

  const loadedCount =
    teacher.length +
    classroom.length +
    occupancy.length +
    process.length +
    staff.length +
    space.length +
    discipline.length +
    parent.length +
    compliance.length +
    scoreInputs.length;
  return loadedCount > 0;
}
