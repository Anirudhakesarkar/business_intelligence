export type DailySummaryModule =
  | 'teacher'
  | 'classroom'
  | 'occupancy'
  | 'process'
  | 'staff'
  | 'space'
  | 'discipline'
  | 'parent'
  | 'compliance'
  | 'school';

export type CalendarDayType = 'WorkingDay' | 'Holiday' | 'ExamDay' | 'HalfDay' | 'StaffOnly';
export type TimeWindowKind = 'Arrival' | 'Period' | 'Lunch' | 'Dispersal' | 'AfterHours' | 'Unknown';

export type EventBusinessContext = {
  calendarDayType: CalendarDayType;
  periodId?: number;
  classId?: number;
  sectionId?: number;
  subjectId?: number;
  teacherIdExpected?: number;
  timeWindow: TimeWindowKind;
  dutyRosterRole?: string;
  cameraPurpose?: string;
  processOwner?: string;
  riskZoneCategory?: string;
  roomId?: number;
  zoneId?: number;
  excludeFromAggregation: boolean;
};

export type SummaryFact = { text: string; metricKey?: string; eventTypes?: string[] };

export type DailyRowBase = {
  id: number;
  organizationId: number;
  siteId?: number;
  summaryDate: string;
  metrics: Record<string, number | string | boolean | null>;
  facts: SummaryFact[];
  createdAt: string;
  updatedAt?: string;
};

export type TeacherDailyRow = DailyRowBase & { teacherId?: number };
export type ClassroomDailyRow = DailyRowBase & { roomId?: number; classId?: number; sectionId?: number };
export type OccupancyDailyRow = DailyRowBase & { roomId?: number; zoneId?: number };
export type ProcessDailyRow = DailyRowBase & { timeWindow?: string };
export type StaffDailyRow = DailyRowBase & { zoneId?: number; dutyRole?: string };
export type SpaceDailyRow = DailyRowBase & { roomId?: number };
export type DisciplineDailyRow = DailyRowBase & { zoneId?: number };
export type ParentDailyRow = DailyRowBase;
export type ComplianceDailyRow = DailyRowBase;
/**
 * school_daily_score.inputs_json (Phase 4 fact bundle for Phase 5 scoring).
 * MVP3 keys: teacher, classroom, occupancy, parent, process (+ placeholders: staff, space, discipline, compliance, safety, security).
 */
export type ScoreInputsJson = {
  teacher?: Record<string, unknown>;
  classroom?: { conducted_pct?: number; late_count?: number; missed_count?: number };
  occupancy?: { expected_match?: number; expected_match_pct?: number; overcrowding_count?: number; underuse_count?: number; empty_room_count?: number };
  parent?: Record<string, unknown>;
  process?: { dispersal_congestion_min?: number; overlap_count?: number; delay_min?: number };
  staff?: Record<string, unknown>;
  space?: Record<string, unknown>;
  discipline?: Record<string, unknown>;
  compliance?: Record<string, unknown>;
  safety?: { placeholder?: boolean };
  security?: { placeholder?: boolean };
};

export type ScoreInputsRow = DailyRowBase & { inputsJson: ScoreInputsJson };

export type ModuleOverviewSlice = {
  module: DailySummaryModule;
  label: string;
  rowCount: number;
  headlineMetrics: Record<string, number | string | null>;
  facts: SummaryFact[];
};

export type DailyOverviewResponse = {
  organizationId: number;
  siteId?: number;
  date: string;
  modules: ModuleOverviewSlice[];
  scoreInputs?: ScoreInputsRow;
  aggregatedAt?: string;
};
