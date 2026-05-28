import { listClasses, listSections, listSubjects, listTeachers } from './foundation-org';
import { listRooms } from './foundation-spatial';
import { clearTimetableForOrg, createTimetableEntry } from './foundation-schedule';
import type { TimetableImportRow } from './timetable-import';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;

const PERIODS = [
  { start: '08:30', end: '09:15', subjectIndex: 0 },
  { start: '09:20', end: '10:05', subjectIndex: 1 },
  { start: '10:30', end: '11:15', subjectIndex: 2 },
  { start: '11:20', end: '12:05', subjectIndex: 1 },
] as const;

const TARGET_SECTIONS = [
  { className: 'Grade 1', sectionName: 'A' },
  { className: 'Grade 1', sectionName: 'B' },
  { className: 'Grade 2', sectionName: 'A' },
] as const;

function norm(s: string) {
  return s.trim().toLowerCase();
}

/** Static CSV for manual import when demo seed names match. */
export function buildReadableTimetableSampleRows(
  roomCodes: string[],
  teacherNames: string[],
  subjectNames: string[],
): TimetableImportRow[] {
  const rows: TimetableImportRow[] = [];
  let tIdx = 0;
  for (const spec of TARGET_SECTIONS) {
    for (const day of DAY_NAMES) {
      PERIODS.forEach((p, pi) => {
        const roomCode = roomCodes[(pi + spec.sectionName.charCodeAt(0)) % roomCodes.length];
        const teacherName = teacherNames[tIdx++ % teacherNames.length];
        const subjectName = subjectNames[p.subjectIndex % subjectNames.length] ?? 'Period';
        rows.push({
          className: spec.className,
          sectionName: spec.sectionName,
          subjectName,
          teacherName,
          roomCode,
          day,
          startTime: p.start,
          endTime: p.end,
          periodType: 'Period',
        });
      });
    }
  }
  return rows;
}

export const READABLE_TIMETABLE_SAMPLE_CSV = `className,sectionName,subjectName,teacherName,roomCode,day,startTime,endTime,periodType
Grade 1,A,Mathematics,Teacher 1,R-001,Monday,08:30,09:15,Period
Grade 1,A,English,Teacher 2,R-002,Monday,09:20,10:05,Period`;

export type SeedReadableTimetableResult = {
  replaced: number;
  created: number;
  sections: string[];
  hint: string;
};

/**
 * Replace org timetable with a small, readable sample (Grade 1 A/B, Grade 2 A).
 * Uses existing rooms, teachers, and subjects from Master Data.
 */
export async function seedReadableTimetableSample(
  organizationId = 1,
  options?: { replaceExisting?: boolean },
): Promise<SeedReadableTimetableResult> {
  const replaceExisting = options?.replaceExisting !== false;

  const [classes, sections, subjects, teachers, rooms] = await Promise.all([
    listClasses(organizationId),
    listSections(),
    listSubjects(organizationId),
    listTeachers(organizationId),
    listRooms(organizationId),
  ]);

  const activeRooms = rooms.filter((r) => r.isActive !== false);
  const activeTeachers = teachers.filter((t) => t.isActive !== false);
  const activeSubjects = subjects.filter((s) => s.isActive !== false);

  if (!activeRooms.length) {
    throw new Error('No rooms in Master Data — add rooms or run “Seed demo data” on Master Data first.');
  }
  if (!activeTeachers.length) {
    throw new Error('No teachers in Master Data — add teachers or run “Seed demo data” first.');
  }
  if (!activeSubjects.length) {
    throw new Error('No subjects in Master Data — add subjects or run “Seed demo data” first.');
  }

  const resolvedSections: { label: string; sectionId: number }[] = [];
  const missing: string[] = [];
  for (const target of TARGET_SECTIONS) {
    const cls = classes.find((c) => norm(c.name) === norm(target.className));
    if (!cls) {
      missing.push(target.className);
      continue;
    }
    const sec = sections.find(
      (s) => s.classId === cls.id && norm(s.name) === norm(target.sectionName),
    );
    if (!sec) missing.push(`${target.className} — ${target.sectionName}`);
    else resolvedSections.push({ label: `${cls.name} — ${sec.name}`, sectionId: sec.id });
  }

  if (!resolvedSections.length) {
    throw new Error(
      `Could not find sample sections (Grade 1 A/B, Grade 2 A). Missing: ${missing.join(', ')}. Run “Seed demo data” on Master Data.`,
    );
  }

  const roomPool = activeRooms.slice(0, Math.min(6, activeRooms.length));
  const teacherPool = activeTeachers.slice(0, Math.min(12, activeTeachers.length));
  const subjectPool = activeSubjects.slice(0, Math.min(3, activeSubjects.length));

  let replaced = 0;
  if (replaceExisting) {
    const cleared = await clearTimetableForOrg(organizationId);
    replaced = cleared.deleted;
  }

  let created = 0;
  let teacherIdx = 0;
  for (const { sectionId, label } of resolvedSections) {
    for (let day = 1; day <= 5; day++) {
      for (let pi = 0; pi < PERIODS.length; pi++) {
        const p = PERIODS[pi];
        const room = roomPool[(pi + sectionId) % roomPool.length];
        const teacher = teacherPool[teacherIdx++ % teacherPool.length];
        const subject = subjectPool[p.subjectIndex % subjectPool.length];
        await createTimetableEntry({
          organizationId,
          sectionId,
          roomId: room.id,
          teacherId: teacher.id,
          subjectId: subject.id,
          dayOfWeek: day,
          startTime: p.start,
          endTime: p.end,
          periodType: 'Period',
        });
        created++;
      }
    }
    void label;
  }

  return {
    replaced,
    created,
    sections: resolvedSections.map((s) => s.label),
    hint: 'Set filters: Class → Grade 1, Section → A, then open Weekly Grid.',
  };
}
