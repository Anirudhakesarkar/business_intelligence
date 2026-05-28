import { db } from '@/lib/school-foundation/store';
import { mapEventToContext } from '@/lib/school-daily-summaries/context';
import type { IntelligenceEvent } from './types';
import { getRule } from './store';

export type IntelligenceEventDetailContext = {
  ruleName?: string;
  roomName?: string;
  zoneName?: string;
  className?: string;
  sectionName?: string;
  subjectName?: string;
  periodLabel?: string;
  timeWindow?: string;
  calendarDayType?: string;
  processOwner?: string;
  dutyRosterRole?: string;
  cameraPurpose?: string;
};

export function enrichIntelligenceEventDetail(event: IntelligenceEvent): IntelligenceEventDetailContext {
  const rule = event.ruleId != null ? getRule(event.ruleId) : undefined;
  const biz = mapEventToContext(event);
  const room = event.roomId != null ? db.rooms().find((r) => r.id === event.roomId) : undefined;
  const zone = event.zoneId != null ? db.zones().find((z) => z.id === event.zoneId) : undefined;
  const cls = event.classId != null ? db.classes().find((c) => c.id === event.classId) : undefined;
  let sectionName: string | undefined;
  let subjectName: string | undefined;
  let periodLabel: string | undefined;
  if (event.periodId != null) {
    const te = db.timetable().find((t) => t.id === event.periodId);
    if (te) {
      periodLabel = `${te.startTime}–${te.endTime}`;
      const sec = te.sectionId != null ? db.sections().find((s) => s.id === te.sectionId) : undefined;
      sectionName = sec?.name;
      const subj = te.subjectId != null ? db.subjects().find((s) => s.id === te.subjectId) : undefined;
      subjectName = subj?.name;
    }
  }
  if (!sectionName && biz.sectionId != null) {
    sectionName = db.sections().find((s) => s.id === biz.sectionId)?.name;
  }
  if (!subjectName && biz.subjectId != null) {
    subjectName = db.subjects().find((s) => s.id === biz.subjectId)?.name;
  }
  return {
    ruleName: rule?.name,
    roomName: room?.roomName ?? room?.roomCode,
    zoneName: zone?.name,
    className: cls?.name,
    sectionName,
    subjectName,
    periodLabel,
    timeWindow: biz.timeWindow,
    calendarDayType: biz.calendarDayType,
    processOwner: biz.processOwner,
    dutyRosterRole: biz.dutyRosterRole,
    cameraPurpose: biz.cameraPurpose,
  };
}
