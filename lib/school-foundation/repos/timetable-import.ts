import { listClasses, listSections, listSubjects, listTeachers } from './foundation-org';
import { listRooms } from './foundation-spatial';
import { createTimetableEntry, listTimetableEntries } from './foundation-schedule';

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export type TimetableImportRow = Record<string, string | number | undefined>;

export type TimetableImportValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  previewCount: number;
  existingCount: number;
  resolvedPreview?: ResolvedPreview[];
};

type ResolvedPreview = {
  className: string;
  sectionName: string;
  subjectName: string;
  teacherName: string;
  roomCode: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  periodType: string;
};

type ResolvedRow = {
  sectionId: number;
  roomId: number;
  teacherId?: number;
  subjectId?: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  periodType: string;
  preview: ResolvedPreview;
};

function norm(s: unknown): string {
  return String(s ?? '').trim().toLowerCase();
}

function pick(row: TimetableImportRow, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function parseDayOfWeek(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (Number.isFinite(n) && n >= 1 && n <= 7) return Math.floor(n);
  const idx = DAY_NAMES.indexOf(t.toLowerCase());
  if (idx >= 0) return idx + 1;
  return null;
}

function parseTime(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

async function buildLookup(organizationId: number) {
  const [classes, sections, subjects, teachers, rooms] = await Promise.all([
    listClasses(organizationId),
    listSections(),
    listSubjects(organizationId),
    listTeachers(organizationId),
    listRooms(organizationId),
  ]);
  const orgSections = sections.filter((s) =>
    classes.some((c) => c.id === s.classId),
  );
  return { classes, sections: orgSections, subjects, teachers, rooms };
}

function resolveRow(
  row: TimetableImportRow,
  rowNum: number,
  ctx: Awaited<ReturnType<typeof buildLookup>>,
): { ok: true; value: ResolvedRow } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const sectionIdRaw = pick(row, 'sectionId', 'section_id');
  const className = pick(row, 'className', 'class', 'grade', 'class_name');
  const sectionName = pick(row, 'sectionName', 'section', 'section_name');
  let section = sectionIdRaw
    ? ctx.sections.find((s) => String(s.id) === sectionIdRaw)
    : undefined;
  if (!section && className && sectionName) {
    const cls = ctx.classes.find((c) => norm(c.name) === norm(className));
    if (!cls) errors.push(`Row ${rowNum}: class "${className}" not found`);
    else {
      section = ctx.sections.find(
        (s) => s.classId === cls.id && norm(s.name) === norm(sectionName),
      );
      if (!section) errors.push(`Row ${rowNum}: section "${sectionName}" not found in ${className}`);
    }
  } else if (!section) {
    errors.push(`Row ${rowNum}: provide sectionId or className + sectionName`);
  }

  const roomIdRaw = pick(row, 'roomId', 'room_id');
  const roomCode = pick(row, 'roomCode', 'room_code', 'room');
  let room = roomIdRaw ? ctx.rooms.find((r) => String(r.id) === roomIdRaw) : undefined;
  if (!room && roomCode) {
    room = ctx.rooms.find((r) => norm(r.roomCode) === norm(roomCode));
    if (!room) errors.push(`Row ${rowNum}: room "${roomCode}" not found`);
  } else if (!room) {
    errors.push(`Row ${rowNum}: provide roomId or roomCode`);
  }

  const subjectIdRaw = pick(row, 'subjectId', 'subject_id');
  const subjectName = pick(row, 'subjectName', 'subject', 'subject_name');
  let subject = subjectIdRaw ? ctx.subjects.find((s) => String(s.id) === subjectIdRaw) : undefined;
  if (!subject && subjectName) {
    subject = ctx.subjects.find((s) => norm(s.name) === norm(subjectName));
    if (!subject) errors.push(`Row ${rowNum}: subject "${subjectName}" not found`);
  }

  const teacherIdRaw = pick(row, 'teacherId', 'teacher_id');
  const teacherName = pick(row, 'teacherName', 'teacher', 'teacher_name');
  let teacher = teacherIdRaw ? ctx.teachers.find((t) => String(t.id) === teacherIdRaw) : undefined;
  if (!teacher && teacherName) {
    teacher = ctx.teachers.find((t) => norm(t.name) === norm(teacherName));
    if (!teacher) errors.push(`Row ${rowNum}: teacher "${teacherName}" not found`);
  }

  const dayRaw = pick(row, 'dayOfWeek', 'day_of_week', 'day');
  const dayOfWeek = parseDayOfWeek(dayRaw);
  if (dayOfWeek == null) errors.push(`Row ${rowNum}: invalid day (use Monday or 1–6)`);

  const startTime = parseTime(pick(row, 'startTime', 'start_time', 'start'));
  const endTime = parseTime(pick(row, 'endTime', 'end_time', 'end'));
  if (!startTime || !endTime) errors.push(`Row ${rowNum}: startTime and endTime required (HH:MM)`);
  else if (endTime <= startTime) errors.push(`Row ${rowNum}: endTime must be after startTime`);

  const periodType = pick(row, 'periodType', 'period_type', 'type') || 'Period';

  if (errors.length || !section || !room || dayOfWeek == null || !startTime || !endTime) {
    return { ok: false, errors };
  }

  const cls = ctx.classes.find((c) => c.id === section!.classId);
  return {
    ok: true,
    value: {
      sectionId: section.id,
      roomId: room.id,
      teacherId: teacher?.id,
      subjectId: subject?.id,
      dayOfWeek,
      startTime,
      endTime,
      periodType,
      preview: {
        className: cls?.name ?? String(section.classId),
        sectionName: section.name,
        subjectName: subject?.name ?? '—',
        teacherName: teacher?.name ?? '—',
        roomCode: room.roomCode,
        dayOfWeek,
        startTime,
        endTime,
        periodType,
      },
    },
  };
}

export async function validateTimetableImport(
  organizationId: number,
  rows: TimetableImportRow[],
): Promise<TimetableImportValidation> {
  const ctx = await buildLookup(organizationId);
  const errors: string[] = [];
  const warnings: string[] = [];
  const resolved: ResolvedRow[] = [];

  if (!rows.length) {
    return { valid: false, errors: ['CSV has no data rows'], warnings: [], previewCount: 0, existingCount: 0 };
  }

  rows.forEach((row, i) => {
    const result = resolveRow(row, i + 2, ctx);
    if (!result.ok) errors.push(...result.errors);
    else resolved.push(result.value);
  });

  const slots = resolved.map((r, i) => ({
    roomId: r.roomId,
    dayOfWeek: r.dayOfWeek,
    start: r.startTime,
    end: r.endTime,
    row: i + 2,
  }));
  for (let a = 0; a < slots.length; a++) {
    for (let b = a + 1; b < slots.length; b++) {
      const x = slots[a];
      const y = slots[b];
      if (
        x.roomId === y.roomId &&
        x.dayOfWeek === y.dayOfWeek &&
        x.start < y.end &&
        y.start < x.end
      ) {
        errors.push(`Row ${y.row}: room double-booked (overlaps row ${x.row})`);
      }
    }
  }

  const existing = (await listTimetableEntries(organizationId)).filter((t) => t.isActive);
  for (const r of resolved) {
    const clash = existing.some(
      (t) =>
        t.roomId === r.roomId &&
        t.dayOfWeek === r.dayOfWeek &&
        r.startTime < t.endTime &&
        t.startTime < r.endTime,
    );
    if (clash) {
      warnings.push(
        `Row for ${r.preview.sectionName} (${r.preview.className}) may overlap an existing room booking`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    previewCount: rows.length,
    existingCount: existing.length,
    resolvedPreview: resolved.map((r) => r.preview),
  };
}

export async function commitTimetableImport(
  organizationId: number,
  rows: TimetableImportRow[],
): Promise<{ created: number }> {
  const validation = await validateTimetableImport(organizationId, rows);
  if (!validation.valid) throw new Error(validation.errors.join('; ') || 'Validation failed');

  const ctx = await buildLookup(organizationId);
  let created = 0;
  for (let i = 0; i < rows.length; i++) {
    const result = resolveRow(rows[i], i + 2, ctx);
    if (!result.ok) throw new Error(result.errors.join('; '));
    const r = result.value;
    await createTimetableEntry({
      organizationId,
      sectionId: r.sectionId,
      roomId: r.roomId,
      teacherId: r.teacherId,
      subjectId: r.subjectId,
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
      periodType: r.periodType,
    });
    created++;
  }
  return { created };
}

export const TIMETABLE_CSV_TEMPLATE = `className,sectionName,subjectName,teacherName,roomCode,day,startTime,endTime,periodType
Grade 1,A,Mathematics,Teacher 1,R-001,Monday,08:00,08:45,Period
Grade 1,A,English,Teacher 2,R-002,Monday,08:45,09:30,Period
Grade 2,B,Science,Teacher 3,R-003,Tuesday,08:00,08:45,Period`;
