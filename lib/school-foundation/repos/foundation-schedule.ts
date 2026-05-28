import type { CalendarDay, DayType, DutyRoster, TimeWindow, TimetableEntry } from '../types';
import { orgIdFromPg, resolveOrgIdForPg } from '../../school-db/organization-id';
import { db as memDb, logAudit, patchTimetableEntry as patchTimetableEntryMem, _ensureNextIdAbove } from '../store';
import { dbQuery, isDbEnabled, num, requirePool, withDbTransaction, type DbQueryFn } from './shared';

function timeToStr(t: string | Date | null): string {
  if (!t) return '';
  const s = typeof t === 'string' ? t : t.toISOString();
  return s.length >= 5 ? s.slice(11, 16) || s.slice(0, 5) : s;
}

// ─── Calendar ────────────────────────────────────────────────────────────────

type CalendarRow = {
  id: string | number;
  organization_id: string | number;
  calendar_date: string | Date;
  day_type: string;
  label: string | null;
  timing_override: Record<string, unknown> | null;
};

function calendarFromRow(r: CalendarRow): CalendarDay {
  const d = r.calendar_date instanceof Date ? r.calendar_date.toISOString().slice(0, 10) : String(r.calendar_date).slice(0, 10);
  return {
    id: num(r.id),
    organizationId: orgIdFromPg(r.organization_id),
    calendarDate: d,
    dayType: r.day_type as DayType,
    label: r.label ?? undefined,
    timingOverride: r.timing_override ?? undefined,
  };
}

function mirrorCalendar(row: CalendarDay) {
  const arr = memDb.calendar();
  const i = arr.findIndex((c) => c.organizationId === row.organizationId && c.calendarDate === row.calendarDate);
  if (i >= 0) arr[i] = row;
  else arr.push(row);
  _ensureNextIdAbove(row.id);
}

export async function listCalendarDays(organizationId?: number | string): Promise<CalendarDay[]> {
  if (!isDbEnabled()) {
    if (organizationId == null) return [...memDb.calendar()];
    const org = Number(organizationId);
    return memDb.calendar().filter((c) => c.organizationId === org);
  }
  requirePool();
  const sql = organizationId
    ? `SELECT id, organization_id, calendar_date, day_type, label, timing_override FROM school_calendars WHERE organization_id = $1 ORDER BY calendar_date`
    : `SELECT id, organization_id, calendar_date, day_type, label, timing_override FROM school_calendars ORDER BY calendar_date`;
  const params = organizationId ? [resolveOrgIdForPg(organizationId)] : [];
  const r = await dbQuery<CalendarRow>(sql, params);
  const rows = (r?.rows ?? []).map(calendarFromRow);
  for (const row of rows) mirrorCalendar(row);
  return rows;
}

export async function createCalendarDay(input: Omit<CalendarDay, 'id'>): Promise<CalendarDay> {
  requirePool();
  const pgOrg = resolveOrgIdForPg(input.organizationId);
  const existing = await dbQuery<CalendarRow>(
    `SELECT id, organization_id, calendar_date, day_type, label, timing_override
     FROM school_calendars WHERE organization_id = $1 AND calendar_date = $2`,
    [pgOrg, input.calendarDate],
  );
  if (existing?.rows[0]) {
    const r = await dbQuery<CalendarRow>(
      `UPDATE school_calendars SET day_type = $1, label = $2, timing_override = $3::jsonb
       WHERE id = $4
       RETURNING id, organization_id, calendar_date, day_type, label, timing_override`,
      [input.dayType, input.label ?? null, JSON.stringify(input.timingOverride ?? null), existing.rows[0].id],
    );
    const row = calendarFromRow(r!.rows[0]);
    mirrorCalendar(row);
    logAudit('update', 'school_calendar', row.id, row);
    return row;
  }
  const r = await dbQuery<CalendarRow>(
    `INSERT INTO school_calendars (organization_id, calendar_date, day_type, label, timing_override)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, organization_id, calendar_date, day_type, label, timing_override`,
    [pgOrg, input.calendarDate, input.dayType, input.label ?? null, JSON.stringify(input.timingOverride ?? null)],
  );
  if (!r?.rows[0]) throw new Error('Failed to create calendar day');
  const row = calendarFromRow(r.rows[0]);
  mirrorCalendar(row);
  logAudit('create', 'school_calendar', row.id, row);
  return row;
}

export async function hydrateCalendarFromPg(): Promise<{ hydrated: number }> {
  const rows = await listCalendarDays();
  return { hydrated: rows.length };
}

export async function getCalendarDayById(id: number): Promise<CalendarDay | null> {
  if (!isDbEnabled()) {
    return memDb.calendar().find((c) => c.id === id) ?? null;
  }
  requirePool();
  const r = await dbQuery<CalendarRow>(
    `SELECT id, organization_id, calendar_date, day_type, label, timing_override FROM school_calendars WHERE id = $1`,
    [id],
  );
  const row = r?.rows[0];
  if (!row) return null;
  const day = calendarFromRow(row);
  mirrorCalendar(day);
  return day;
}

export type PatchCalendarInput = Partial<Pick<CalendarDay, 'dayType' | 'label' | 'timingOverride' | 'calendarDate'>>;

export async function patchCalendarDay(id: number, patch: PatchCalendarInput): Promise<CalendarDay> {
  requirePool();
  const existing = await getCalendarDayById(id);
  if (!existing) throw new Error('Calendar day not found');
  const merged: CalendarDay = {
    ...existing,
    ...patch,
    calendarDate: patch.calendarDate ?? existing.calendarDate,
    dayType: patch.dayType ?? existing.dayType,
    label: patch.label !== undefined ? patch.label : existing.label,
    timingOverride: patch.timingOverride !== undefined ? patch.timingOverride : existing.timingOverride,
  };
  const r = await dbQuery<CalendarRow>(
    `UPDATE school_calendars SET calendar_date = $1, day_type = $2, label = $3, timing_override = $4::jsonb
     WHERE id = $5
     RETURNING id, organization_id, calendar_date, day_type, label, timing_override`,
    [
      merged.calendarDate,
      merged.dayType,
      merged.label ?? null,
      JSON.stringify(merged.timingOverride ?? null),
      id,
    ],
  );
  if (!r?.rows[0]) throw new Error('Calendar day not found');
  const row = calendarFromRow(r.rows[0]);
  mirrorCalendar(row);
  logAudit('update', 'school_calendar', id, row);
  return row;
}

export async function deleteCalendarDay(id: number): Promise<{ ok: true }> {
  requirePool();
  const before = await getCalendarDayById(id);
  if (!before) throw new Error('Calendar day not found');
  await dbQuery(`DELETE FROM school_calendars WHERE id = $1`, [id]);
  const arr = memDb.calendar();
  const i = arr.findIndex((c) => c.id === id);
  if (i >= 0) arr.splice(i, 1);
  logAudit('delete', 'school_calendar', id, undefined, before);
  return { ok: true };
}

async function upsertCalendarDayTx(query: DbQueryFn, input: Omit<CalendarDay, 'id'>): Promise<CalendarDay> {
  const pgOrg = resolveOrgIdForPg(input.organizationId);
  const existing = await query<CalendarRow>(
    `SELECT id, organization_id, calendar_date, day_type, label, timing_override
     FROM school_calendars WHERE organization_id = $1 AND calendar_date = $2`,
    [pgOrg, input.calendarDate],
  );
  if (existing?.rows[0]) {
    const r = await query<CalendarRow>(
      `UPDATE school_calendars SET day_type = $1, label = $2, timing_override = $3::jsonb
       WHERE id = $4
       RETURNING id, organization_id, calendar_date, day_type, label, timing_override`,
      [
        input.dayType,
        input.label ?? null,
        JSON.stringify(input.timingOverride ?? null),
        existing.rows[0].id,
      ],
    );
    if (!r?.rows[0]) throw new Error('Failed to update calendar day');
    return calendarFromRow(r.rows[0]);
  }
  const r = await query<CalendarRow>(
    `INSERT INTO school_calendars (organization_id, calendar_date, day_type, label, timing_override)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, organization_id, calendar_date, day_type, label, timing_override`,
    [pgOrg, input.calendarDate, input.dayType, input.label ?? null, JSON.stringify(input.timingOverride ?? null)],
  );
  if (!r?.rows[0]) throw new Error('Failed to create calendar day');
  return calendarFromRow(r.rows[0]);
}

/** Upsert many calendar days in one Postgres transaction. */
export async function commitCalendarBulk(
  days: Omit<CalendarDay, 'id'>[],
): Promise<{ count: number; days: CalendarDay[] }> {
  if (!days.length) return { count: 0, days: [] };
  if (!isDbEnabled()) {
    const created: CalendarDay[] = [];
    for (const input of days) {
      created.push(await createCalendarDay(input));
    }
    return { count: created.length, days: created };
  }
  const organizationId = days[0].organizationId;
  const rows = await withDbTransaction(async (query) => {
    const out: CalendarDay[] = [];
    for (const input of days) {
      const row = await upsertCalendarDayTx(query, input);
      out.push(row);
    }
    return out;
  });
  for (const row of rows) mirrorCalendar(row);
  await listCalendarDays(organizationId);
  return { count: rows.length, days: rows };
}

// ─── Time windows ────────────────────────────────────────────────────────────

type TimeWindowRow = {
  id: string | number;
  organization_id: string | number;
  name: string;
  window_type: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

function timeWindowFromRow(r: TimeWindowRow): TimeWindow {
  return {
    id: num(r.id),
    organizationId: orgIdFromPg(r.organization_id),
    name: r.name,
    windowType: r.window_type,
    startTime: timeToStr(r.start_time),
    endTime: timeToStr(r.end_time),
    isActive: r.is_active,
  };
}

function mirrorTimeWindow(row: TimeWindow) {
  const arr = memDb.timeWindows();
  if (!arr.some((t) => t.id === row.id)) arr.push(row);
  _ensureNextIdAbove(row.id);
}

export async function listTimeWindows(organizationId?: number | string): Promise<TimeWindow[]> {
  if (!isDbEnabled()) {
    if (organizationId == null) return [...memDb.timeWindows()];
    const org = Number(organizationId);
    return memDb.timeWindows().filter((t) => t.organizationId === org);
  }
  requirePool();
  const sql = organizationId
    ? `SELECT id, organization_id, name, window_type, start_time, end_time, is_active FROM school_time_windows WHERE organization_id = $1 ORDER BY id`
    : `SELECT id, organization_id, name, window_type, start_time, end_time, is_active FROM school_time_windows ORDER BY id`;
  const params = organizationId ? [resolveOrgIdForPg(organizationId)] : [];
  const r = await dbQuery<TimeWindowRow>(sql, params);
  const rows = (r?.rows ?? []).map(timeWindowFromRow);
  for (const row of rows) mirrorTimeWindow(row);
  return rows;
}

export async function createTimeWindow(input: Omit<TimeWindow, 'id'>): Promise<TimeWindow> {
  requirePool();
  if (input.endTime <= input.startTime) throw new Error('End time must be after start time.');
  const r = await dbQuery<TimeWindowRow>(
    `INSERT INTO school_time_windows (organization_id, name, window_type, start_time, end_time, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, organization_id, name, window_type, start_time, end_time, is_active`,
    [
      resolveOrgIdForPg(input.organizationId),
      input.name.trim(),
      input.windowType,
      input.startTime,
      input.endTime,
      input.isActive ?? true,
    ],
  );
  if (!r?.rows[0]) throw new Error('Failed to create time window');
  const row = timeWindowFromRow(r.rows[0]);
  mirrorTimeWindow(row);
  return row;
}

export async function hydrateTimeWindowsFromPg(): Promise<{ hydrated: number }> {
  const rows = await listTimeWindows();
  return { hydrated: rows.length };
}

// ─── Timetable ───────────────────────────────────────────────────────────────

type TimetableRow = {
  id: string | number;
  organization_id: string | number;
  section_id: string | number;
  subject_id: string | number | null;
  room_id: string | number;
  teacher_id: string | number | null;
  period_type: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

function timetableFromRow(r: TimetableRow): TimetableEntry {
  return {
    id: num(r.id),
    organizationId: orgIdFromPg(r.organization_id),
    sectionId: num(r.section_id),
    subjectId: r.subject_id != null ? num(r.subject_id) : undefined,
    roomId: num(r.room_id),
    teacherId: r.teacher_id != null ? num(r.teacher_id) : undefined,
    periodType: r.period_type,
    dayOfWeek: r.day_of_week,
    startTime: timeToStr(r.start_time),
    endTime: timeToStr(r.end_time),
    isActive: r.is_active,
  };
}

function mirrorTimetable(row: TimetableEntry) {
  const arr = memDb.timetable();
  if (!arr.some((t) => t.id === row.id)) arr.push(row);
  _ensureNextIdAbove(row.id);
}

function periodsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

export async function listTimetableEntries(organizationId?: number | string): Promise<TimetableEntry[]> {
  if (!isDbEnabled()) {
    if (organizationId == null) return [...memDb.timetable()];
    const org = Number(organizationId);
    return memDb.timetable().filter((t) => t.organizationId === org);
  }
  requirePool();
  const sql = organizationId
    ? `SELECT id, organization_id, section_id, subject_id, room_id, teacher_id, period_type, day_of_week, start_time, end_time, is_active
       FROM school_timetable_entries WHERE organization_id = $1 ORDER BY id`
    : `SELECT id, organization_id, section_id, subject_id, room_id, teacher_id, period_type, day_of_week, start_time, end_time, is_active
       FROM school_timetable_entries ORDER BY id`;
  const params = organizationId ? [resolveOrgIdForPg(organizationId)] : [];
  const r = await dbQuery<TimetableRow>(sql, params);
  const rows = (r?.rows ?? []).map(timetableFromRow);
  for (const row of rows) mirrorTimetable(row);
  return rows;
}

export async function createTimetableEntry(input: Omit<TimetableEntry, 'id' | 'isActive'>): Promise<TimetableEntry> {
  requirePool();
  if (input.endTime <= input.startTime) throw new Error('End time must be after start time.');
  const active = await listTimetableEntries(input.organizationId);
  const roomConflict = active.some(
    (t) =>
      t.isActive &&
      t.roomId === input.roomId &&
      t.dayOfWeek === input.dayOfWeek &&
      periodsOverlap(t.startTime, t.endTime, input.startTime, input.endTime),
  );
  if (roomConflict) throw new Error('Room has overlapping timetable period.');
  const r = await dbQuery<TimetableRow>(
    `INSERT INTO school_timetable_entries (
       organization_id, section_id, subject_id, room_id, teacher_id, period_type, day_of_week, start_time, end_time, is_active
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE)
     RETURNING id, organization_id, section_id, subject_id, room_id, teacher_id, period_type, day_of_week, start_time, end_time, is_active`,
    [
      resolveOrgIdForPg(input.organizationId),
      input.sectionId,
      input.subjectId ?? null,
      input.roomId,
      input.teacherId ?? null,
      input.periodType,
      input.dayOfWeek,
      input.startTime,
      input.endTime,
    ],
  );
  if (!r?.rows[0]) throw new Error('Failed to create timetable entry');
  const row = timetableFromRow(r.rows[0]);
  mirrorTimetable(row);
  logAudit('create', 'timetable', row.id, row);
  return row;
}

/** Remove all timetable rows for an org (Postgres + in-memory cache). */
export async function clearTimetableForOrg(organizationId: number): Promise<{ deleted: number }> {
  requirePool();
  const pgOrg = resolveOrgIdForPg(organizationId);
  const r = await dbQuery<{ count: string }>(
    `WITH d AS (
       DELETE FROM school_timetable_entries WHERE organization_id = $1 RETURNING id
     ) SELECT COUNT(*)::text AS count FROM d`,
    [pgOrg],
  );
  const deleted = Number(r?.rows[0]?.count ?? 0);
  const arr = memDb.timetable();
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].organizationId === organizationId) arr.splice(i, 1);
  }
  return { deleted };
}

export type PatchTimetableInput = Partial<
  Pick<TimetableEntry, 'sectionId' | 'subjectId' | 'roomId' | 'teacherId' | 'periodType' | 'dayOfWeek' | 'startTime' | 'endTime'>
>;

export async function patchTimetableEntry(id: number, patch: PatchTimetableInput): Promise<TimetableEntry> {
  if (!isDbEnabled()) return patchTimetableEntryMem(id, patch);
  requirePool();
  const existing = memDb.timetable().find((t) => t.id === id);
  if (!existing) {
    await listTimetableEntries();
    if (!memDb.timetable().find((t) => t.id === id)) throw new Error('Not found');
  }
  const definedPatch = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  ) as PatchTimetableInput;
  const merged = { ...memDb.timetable().find((t) => t.id === id)!, ...definedPatch };
  if (merged.endTime <= merged.startTime) throw new Error('End time must be after start time.');
  const active = memDb.timetable().filter((t) => t.isActive && t.organizationId === merged.organizationId);
  const roomConflict = active.some(
    (t) =>
      t.id !== id &&
      t.roomId === merged.roomId &&
      t.dayOfWeek === merged.dayOfWeek &&
      periodsOverlap(t.startTime, t.endTime, merged.startTime, merged.endTime),
  );
  if (roomConflict) throw new Error('Room has overlapping timetable period.');
  const r = await dbQuery<TimetableRow>(
    `UPDATE school_timetable_entries SET
       section_id = $1, subject_id = $2, room_id = $3, teacher_id = $4, period_type = $5,
       day_of_week = $6, start_time = $7, end_time = $8
     WHERE id = $9 AND is_active = TRUE
     RETURNING id, organization_id, section_id, subject_id, room_id, teacher_id, period_type, day_of_week, start_time, end_time, is_active`,
    [
      merged.sectionId,
      merged.subjectId ?? null,
      merged.roomId,
      merged.teacherId ?? null,
      merged.periodType,
      merged.dayOfWeek,
      merged.startTime,
      merged.endTime,
      id,
    ],
  );
  if (!r?.rows[0]) throw new Error('Not found');
  const row = timetableFromRow(r.rows[0]);
  const arr = memDb.timetable();
  const i = arr.findIndex((t) => t.id === id);
  if (i >= 0) arr[i] = row;
  logAudit('update', 'timetable', id, row);
  return row;
}

export async function deactivateTimetableEntry(id: number): Promise<TimetableEntry> {
  requirePool();
  const r = await dbQuery<TimetableRow>(
    `UPDATE school_timetable_entries SET is_active = FALSE WHERE id = $1
     RETURNING id, organization_id, section_id, subject_id, room_id, teacher_id, period_type, day_of_week, start_time, end_time, is_active`,
    [id],
  );
  if (!r?.rows[0]) throw new Error('Not found');
  const row = timetableFromRow(r.rows[0]);
  const arr = memDb.timetable();
  const i = arr.findIndex((t) => t.id === id);
  if (i >= 0) arr[i] = row;
  return row;
}

export async function hydrateTimetableFromPg(): Promise<{ hydrated: number }> {
  const rows = await listTimetableEntries();
  return { hydrated: rows.length };
}

// ─── Duty rosters ────────────────────────────────────────────────────────────

type RosterRow = {
  id: string | number;
  organization_id: string | number;
  staff_member_id: string | number;
  zone_id: string | number | null;
  duty_type: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_critical_window: boolean;
  is_active: boolean;
};

function rosterFromRow(r: RosterRow): DutyRoster {
  return {
    id: num(r.id),
    organizationId: orgIdFromPg(r.organization_id),
    staffMemberId: num(r.staff_member_id),
    zoneId: r.zone_id != null ? num(r.zone_id) : undefined,
    dutyType: r.duty_type,
    dayOfWeek: r.day_of_week,
    startTime: timeToStr(r.start_time),
    endTime: timeToStr(r.end_time),
    isCriticalWindow: r.is_critical_window,
    isActive: r.is_active,
  };
}

function mirrorRoster(row: DutyRoster) {
  const arr = memDb.rosters();
  if (!arr.some((r) => r.id === row.id)) arr.push(row);
  _ensureNextIdAbove(row.id);
}

export async function listDutyRosters(organizationId?: number | string): Promise<DutyRoster[]> {
  if (!isDbEnabled()) {
    if (organizationId == null) return [...memDb.rosters()];
    const org = Number(organizationId);
    return memDb.rosters().filter((r) => r.organizationId === org);
  }
  requirePool();
  const sql = organizationId
    ? `SELECT id, organization_id, staff_member_id, zone_id, duty_type, day_of_week, start_time, end_time, is_critical_window, is_active
       FROM school_staff_duty_rosters WHERE organization_id = $1 ORDER BY id`
    : `SELECT id, organization_id, staff_member_id, zone_id, duty_type, day_of_week, start_time, end_time, is_critical_window, is_active
       FROM school_staff_duty_rosters ORDER BY id`;
  const params = organizationId ? [resolveOrgIdForPg(organizationId)] : [];
  const r = await dbQuery<RosterRow>(sql, params);
  const rows = (r?.rows ?? []).map(rosterFromRow);
  for (const row of rows) mirrorRoster(row);
  return rows;
}

export async function createDutyRoster(input: Omit<DutyRoster, 'id' | 'isActive'>): Promise<DutyRoster> {
  requirePool();
  if (input.endTime <= input.startTime) throw new Error('End time must be after start time.');
  const r = await dbQuery<RosterRow>(
    `INSERT INTO school_staff_duty_rosters (
       organization_id, staff_member_id, zone_id, duty_type, day_of_week, start_time, end_time, is_critical_window, is_active
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)
     RETURNING id, organization_id, staff_member_id, zone_id, duty_type, day_of_week, start_time, end_time, is_critical_window, is_active`,
    [
      resolveOrgIdForPg(input.organizationId),
      input.staffMemberId,
      input.zoneId ?? null,
      input.dutyType,
      input.dayOfWeek,
      input.startTime,
      input.endTime,
      input.isCriticalWindow ?? false,
    ],
  );
  if (!r?.rows[0]) throw new Error('Failed to create duty roster');
  const row = rosterFromRow(r.rows[0]);
  mirrorRoster(row);
  logAudit('create', 'duty_roster', row.id, row);
  return row;
}

export async function getDutyRoster(id: number): Promise<DutyRoster> {
  if (!isDbEnabled()) {
    const row = memDb.rosters().find((r) => r.id === id);
    if (!row) throw new Error('Not found');
    return row;
  }
  requirePool();
  const r = await dbQuery<RosterRow>(
    `SELECT id, organization_id, staff_member_id, zone_id, duty_type, day_of_week, start_time, end_time, is_critical_window, is_active
     FROM school_staff_duty_rosters WHERE id = $1`,
    [id],
  );
  if (!r?.rows[0]) throw new Error('Not found');
  const row = rosterFromRow(r.rows[0]);
  const arr = memDb.rosters();
  const i = arr.findIndex((x) => x.id === id);
  if (i >= 0) arr[i] = row;
  else mirrorRoster(row);
  return row;
}

export async function patchDutyRoster(id: number, patch: Partial<Omit<DutyRoster, 'id'>>): Promise<DutyRoster> {
  requirePool();
  const existing = await getDutyRoster(id);
  const merged: DutyRoster = { ...existing, ...patch, id };
  if (merged.endTime <= merged.startTime) throw new Error('End time must be after start time.');
  const r = await dbQuery<RosterRow>(
    `UPDATE school_staff_duty_rosters SET
       staff_member_id = $1, zone_id = $2, duty_type = $3, day_of_week = $4,
       start_time = $5, end_time = $6, is_critical_window = $7
     WHERE id = $8
     RETURNING id, organization_id, staff_member_id, zone_id, duty_type, day_of_week, start_time, end_time, is_critical_window, is_active`,
    [
      merged.staffMemberId,
      merged.zoneId ?? null,
      merged.dutyType,
      merged.dayOfWeek,
      merged.startTime,
      merged.endTime,
      merged.isCriticalWindow,
      id,
    ],
  );
  if (!r?.rows[0]) throw new Error('Not found');
  const row = rosterFromRow(r.rows[0]);
  const arr = memDb.rosters();
  const i = arr.findIndex((x) => x.id === id);
  if (i >= 0) arr[i] = row;
  logAudit('update', 'duty_roster', id, row);
  return row;
}

export async function deactivateDutyRoster(id: number): Promise<DutyRoster> {
  requirePool();
  const r = await dbQuery<RosterRow>(
    `UPDATE school_staff_duty_rosters SET is_active = FALSE WHERE id = $1
     RETURNING id, organization_id, staff_member_id, zone_id, duty_type, day_of_week, start_time, end_time, is_critical_window, is_active`,
    [id],
  );
  if (!r?.rows[0]) throw new Error('Not found');
  const row = rosterFromRow(r.rows[0]);
  const arr = memDb.rosters();
  const i = arr.findIndex((x) => x.id === id);
  if (i >= 0) arr[i] = row;
  logAudit('update', 'duty_roster', id, row);
  return row;
}

export async function hydrateRostersFromPg(): Promise<{ hydrated: number }> {
  const rows = await listDutyRosters();
  return { hydrated: rows.length };
}
