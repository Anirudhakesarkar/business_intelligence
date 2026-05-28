import type { IntelligenceEvent, EventType } from '../school-rule-engine/types';
import { db } from '../school-foundation/store';
import type { CalendarDayType, EventBusinessContext, TimeWindowKind } from './types';

function dateOf(iso: string) {
  return iso.slice(0, 10);
}

function parseMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesFromIso(iso: string) {
  const d = new Date(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function calendarFor(organizationId: number, day: string): CalendarDayType {
  const row = db.calendar().find((c) => c.organizationId === organizationId && c.calendarDate === day);
  if (!row) return 'WorkingDay';
  return row.dayType as CalendarDayType;
}

function activeWindow(organizationId: number, atMinutes: number): TimeWindowKind {
  const hit = db
    .timeWindows()
    .find(
      (w) =>
        w.organizationId === organizationId &&
        w.isActive &&
        parseMinutes(w.startTime) <= atMinutes &&
        parseMinutes(w.endTime) > atMinutes
    );
  if (!hit) return 'Unknown';
  const wt = hit.windowType;
  if (wt === 'Arrival' || wt === 'Dispersal' || wt === 'Lunch') return wt;
  if (wt === 'Period') return 'Period';
  return 'Unknown';
}

const EVENT_WINDOW_HINT: Partial<Record<EventType, TimeWindowKind>> = {
  GateCongestion: 'Dispersal',
  ArrivalCongestion: 'Arrival',
  DispersalDelay: 'Dispersal',
  WeakDispersalCoverage: 'Dispersal',
  VehicleStudentOverlap: 'Dispersal',
  ReceptionQueueHigh: 'Arrival',
};

const ROSTER_DUTY_HINT: Partial<Record<EventType, string>> = {
  GateCongestion: 'Gate',
  ArrivalCongestion: 'Gate',
  StaffMissingAtGate: 'Gate',
  StaffMissingAtPlayground: 'Playground',
  WeakDispersalCoverage: 'Gate',
};

const EVENT_PROCESS_OWNER: Partial<Record<EventType, string>> = {
  GateCongestion: 'ParentExperience',
  ArrivalCongestion: 'ParentExperience',
  DispersalDelay: 'ParentExperience',
  VehicleStudentOverlap: 'ParentExperience',
  TeacherSupervisionGap: 'TeacherProductivity',
  LabSupervisionMissing: 'Compliance',
};

export function mapEventToContext(event: IntelligenceEvent): EventBusinessContext {
  const day = dateOf(event.startedAt);
  const calendarDayType = calendarFor(event.organizationId, day);
  const excludeFromAggregation = calendarDayType === 'Holiday';
  const atMin = minutesFromIso(event.startedAt);
  const hinted = EVENT_WINDOW_HINT[event.eventType];
  const timeWindow = hinted ?? activeWindow(event.organizationId, atMin);

  let cameraPurpose: string | undefined;
  if (event.cameraId) {
    const cam = db.cameras().find((c) => c.id === event.cameraId);
    cameraPurpose = cam?.purpose;
  }

  let teacherIdExpected: number | undefined;
  let subjectId: number | undefined;
  let sectionId: number | undefined;
  const dow = new Date(event.startedAt).getDay() || 7;
  const tt = db.timetable().find((e) => {
    if (e.organizationId !== event.organizationId || !e.isActive || e.dayOfWeek !== dow) return false;
    if (parseMinutes(e.startTime) > atMin || parseMinutes(e.endTime) <= atMin) return false;
    if (event.roomId && e.roomId !== event.roomId) return false;
    if (event.classId) {
      const sec = db.sections().find((s) => s.id === e.sectionId);
      if (sec && sec.classId !== event.classId) return false;
    }
    return true;
  });
  if (tt) {
    teacherIdExpected = tt.teacherId;
    subjectId = tt.subjectId;
    sectionId = tt.sectionId;
  }

  let riskZoneCategory: string | undefined;
  if (event.zoneId) {
    const z = db.zones().find((x) => x.id === event.zoneId);
    riskZoneCategory = (z as { riskCategory?: string } | undefined)?.riskCategory;
  }

  let dutyRosterRole: string | undefined;
  const dutyHint = ROSTER_DUTY_HINT[event.eventType];
  const rosterCandidates = db.rosters().filter((r) => {
    if (r.organizationId !== event.organizationId || !r.isActive) return false;
    if (r.dayOfWeek !== dow) return false;
    if (parseMinutes(r.startTime) > atMin || parseMinutes(r.endTime) <= atMin) return false;
    if (dutyHint) return r.dutyType === dutyHint;
    if (event.zoneId && r.zoneId && r.zoneId !== event.zoneId) return false;
    return true;
  });
  const rosterHit = rosterCandidates[0];
  if (rosterHit) dutyRosterRole = rosterHit.dutyType;

  return {
    calendarDayType,
    periodId: event.periodId,
    classId: event.classId,
    sectionId,
    subjectId,
    teacherIdExpected,
    timeWindow,
    cameraPurpose,
    processOwner: EVENT_PROCESS_OWNER[event.eventType],
    dutyRosterRole,
    riskZoneCategory,
    roomId: event.roomId,
    zoneId: event.zoneId,
    excludeFromAggregation,
  };
}
