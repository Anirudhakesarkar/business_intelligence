import type { SchoolClass, Section, StaffMember, Subject, Teacher } from '../types';
import { orgIdFromPg, resolveOrgIdForPg } from '../../school-db/organization-id';
import { db as memDb, logAudit, _ensureNextIdAbove } from '../store';
import { dbQuery, isDbEnabled, num, requirePool } from './shared';

// ─── Classes ─────────────────────────────────────────────────────────────────

type ClassRow = {
  id: string | number;
  organization_id: string | number;
  name: string;
  sort_order: number;
  is_active: boolean;
};

function classFromRow(r: ClassRow): SchoolClass {
  return {
    id: num(r.id),
    organizationId: orgIdFromPg(r.organization_id),
    name: r.name,
    sortOrder: r.sort_order,
    isActive: r.is_active,
  };
}

function mirrorClass(row: SchoolClass) {
  const arr = memDb.classes();
  const i = arr.findIndex((c) => c.id === row.id);
  if (i >= 0) arr[i] = row;
  else arr.push(row);
  _ensureNextIdAbove(row.id);
}

async function getClassById(id: number): Promise<SchoolClass | null> {
  const r = await dbQuery<ClassRow>(
    `SELECT id, organization_id, name, sort_order, is_active FROM school_classes WHERE id = $1`,
    [id],
  );
  return r?.rows[0] ? classFromRow(r.rows[0]) : null;
}

export async function listClasses(organizationId?: number | string): Promise<SchoolClass[]> {
  if (!isDbEnabled()) {
    if (organizationId == null) return [...memDb.classes()];
    const org = Number(organizationId);
    return memDb.classes().filter((c) => c.organizationId === org);
  }
  requirePool();
  const sql = organizationId
    ? `SELECT id, organization_id, name, sort_order, is_active FROM school_classes WHERE organization_id = $1 ORDER BY sort_order, id`
    : `SELECT id, organization_id, name, sort_order, is_active FROM school_classes ORDER BY id`;
  const params = organizationId ? [resolveOrgIdForPg(organizationId)] : [];
  const r = await dbQuery<ClassRow>(sql, params);
  const rows = (r?.rows ?? []).map(classFromRow);
  for (const row of rows) mirrorClass(row);
  return rows;
}

export async function createClass(input: Omit<SchoolClass, 'id'>): Promise<SchoolClass> {
  requirePool();
  const r = await dbQuery<ClassRow>(
    `INSERT INTO school_classes (organization_id, name, sort_order, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING id, organization_id, name, sort_order, is_active`,
    [resolveOrgIdForPg(input.organizationId), input.name.trim(), input.sortOrder ?? 0, input.isActive ?? true],
  );
  if (!r?.rows[0]) throw new Error('Failed to create class');
  const row = classFromRow(r.rows[0]);
  mirrorClass(row);
  logAudit('create', 'class', row.id, row);
  return row;
}

export type PatchClassInput = Partial<Pick<SchoolClass, 'name' | 'sortOrder' | 'isActive'>>;

export async function patchClass(id: number, patch: PatchClassInput): Promise<SchoolClass> {
  requirePool();
  if (patch.name !== undefined && !String(patch.name).trim()) throw new Error('Name required');
  const before = await getClassById(id);
  if (!before) throw new Error('Class not found');

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (patch.name !== undefined) {
    sets.push(`name = $${idx++}`);
    params.push(patch.name.trim());
  }
  if (patch.sortOrder !== undefined) {
    sets.push(`sort_order = $${idx++}`);
    params.push(patch.sortOrder);
  }
  if (patch.isActive !== undefined) {
    sets.push(`is_active = $${idx++}`);
    params.push(patch.isActive);
  }
  if (!sets.length) return before;
  params.push(id);

  const r = await dbQuery<ClassRow>(
    `UPDATE school_classes SET ${sets.join(', ')} WHERE id = $${idx}
     RETURNING id, organization_id, name, sort_order, is_active`,
    params,
  );
  if (!r?.rows[0]) throw new Error('Class not found');
  const row = classFromRow(r.rows[0]);
  mirrorClass(row);
  logAudit('update', 'class', id, row, before);
  return row;
}

export async function deleteClass(id: number): Promise<{ ok: true }> {
  requirePool();
  const existing = await dbQuery<ClassRow>(
    `SELECT id, organization_id, name, sort_order, is_active FROM school_classes WHERE id = $1`,
    [id],
  );
  if (!existing?.rows[0]) throw new Error('Class not found');
  const before = classFromRow(existing.rows[0]);

  await dbQuery(
    `DELETE FROM school_timetable_entries WHERE section_id IN (SELECT id FROM school_sections WHERE class_id = $1)`,
    [id],
  );
  const del = await dbQuery(`DELETE FROM school_classes WHERE id = $1 RETURNING id`, [id]);
  if ((del?.rowCount ?? 0) === 0) throw new Error('Class not found');

  const sectionIds = memDb.sections().filter((s) => s.classId === id).map((s) => s.id);
  const timetable = memDb.timetable();
  for (let i = timetable.length - 1; i >= 0; i--) {
    if (sectionIds.includes(timetable[i].sectionId)) timetable.splice(i, 1);
  }
  const sections = memDb.sections();
  for (let i = sections.length - 1; i >= 0; i--) {
    if (sections[i].classId === id) sections.splice(i, 1);
  }
  const arr = memDb.classes();
  const ci = arr.findIndex((c) => c.id === id);
  if (ci >= 0) arr.splice(ci, 1);
  logAudit('delete', 'class', id, undefined, before);
  return { ok: true };
}

export async function hydrateClassesFromPg(): Promise<{ hydrated: number }> {
  const rows = await listClasses();
  return { hydrated: rows.length };
}

// ─── Sections ────────────────────────────────────────────────────────────────

type SectionRow = {
  id: string | number;
  class_id: string | number;
  name: string;
  expected_student_count: number;
  is_active: boolean;
};

function sectionFromRow(r: SectionRow): Section {
  return {
    id: num(r.id),
    classId: num(r.class_id),
    name: r.name,
    expectedStudentCount: r.expected_student_count,
    isActive: r.is_active,
  };
}

function mirrorSection(row: Section) {
  const arr = memDb.sections();
  const i = arr.findIndex((s) => s.id === row.id);
  if (i >= 0) arr[i] = row;
  else arr.push(row);
  _ensureNextIdAbove(row.id);
}

export async function listSections(classId?: number): Promise<Section[]> {
  if (!isDbEnabled()) {
    if (classId == null) return [...memDb.sections()];
    return memDb.sections().filter((s) => s.classId === classId);
  }
  requirePool();
  const sql = classId
    ? `SELECT id, class_id, name, expected_student_count, is_active FROM school_sections WHERE class_id = $1 ORDER BY id`
    : `SELECT id, class_id, name, expected_student_count, is_active FROM school_sections ORDER BY id`;
  const params = classId ? [classId] : [];
  const r = await dbQuery<SectionRow>(sql, params);
  const rows = (r?.rows ?? []).map(sectionFromRow);
  for (const row of rows) mirrorSection(row);
  return rows;
}

export async function createSection(input: Omit<Section, 'id'>): Promise<Section> {
  requirePool();
  const r = await dbQuery<SectionRow>(
    `INSERT INTO school_sections (class_id, name, expected_student_count, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING id, class_id, name, expected_student_count, is_active`,
    [input.classId, input.name.trim(), input.expectedStudentCount ?? 30, input.isActive ?? true],
  );
  if (!r?.rows[0]) throw new Error('Failed to create section');
  const row = sectionFromRow(r.rows[0]);
  mirrorSection(row);
  return row;
}

export async function patchSection(
  id: number,
  patch: Partial<Pick<Section, 'name' | 'expectedStudentCount' | 'isActive'>>,
): Promise<Section> {
  requirePool();
  if (patch.expectedStudentCount != null && patch.expectedStudentCount < 1) {
    throw new Error('expectedStudentCount must be at least 1');
  }
  if (patch.name !== undefined && !String(patch.name).trim()) throw new Error('Name required');
  const existing = await dbQuery<SectionRow>(
    `SELECT id, class_id, name, expected_student_count, is_active FROM school_sections WHERE id = $1`,
    [id],
  );
  if (!existing?.rows[0]) throw new Error('Section not found');
  const before = sectionFromRow(existing.rows[0]);
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (patch.name !== undefined) {
    sets.push(`name = $${idx++}`);
    params.push(patch.name.trim());
  }
  if (patch.expectedStudentCount !== undefined) {
    sets.push(`expected_student_count = $${idx++}`);
    params.push(patch.expectedStudentCount);
  }
  if (patch.isActive !== undefined) {
    sets.push(`is_active = $${idx++}`);
    params.push(patch.isActive);
  }
  if (!sets.length) return before;
  params.push(id);
  const r = await dbQuery<SectionRow>(
    `UPDATE school_sections SET ${sets.join(', ')} WHERE id = $${idx}
     RETURNING id, class_id, name, expected_student_count, is_active`,
    params,
  );
  if (!r?.rows[0]) throw new Error('Section not found');
  const row = sectionFromRow(r.rows[0]);
  mirrorSection(row);
  logAudit('update', 'section', id, row, before);
  return row;
}

export async function getSectionById(id: number): Promise<Section> {
  requirePool();
  const r = await dbQuery<SectionRow>(
    `SELECT id, class_id, name, expected_student_count, is_active FROM school_sections WHERE id = $1`,
    [id],
  );
  if (!r?.rows[0]) throw new Error('Section not found');
  const row = sectionFromRow(r.rows[0]);
  mirrorSection(row);
  return row;
}

export async function deleteSection(id: number): Promise<{ ok: true }> {
  requirePool();
  const existing = await dbQuery<SectionRow>(
    `SELECT id, class_id, name, expected_student_count, is_active FROM school_sections WHERE id = $1`,
    [id],
  );
  if (!existing?.rows[0]) throw new Error('Section not found');
  const before = sectionFromRow(existing.rows[0]);

  await dbQuery(`DELETE FROM school_timetable_entries WHERE section_id = $1`, [id]);
  const del = await dbQuery(`DELETE FROM school_sections WHERE id = $1 RETURNING id`, [id]);
  if ((del?.rowCount ?? 0) === 0) throw new Error('Section not found');

  const timetable = memDb.timetable();
  for (let i = timetable.length - 1; i >= 0; i--) {
    if (timetable[i].sectionId === id) timetable.splice(i, 1);
  }
  const mappings = memDb.sectionRoomMappings();
  for (let i = mappings.length - 1; i >= 0; i--) {
    if (mappings[i].sectionId === id) mappings.splice(i, 1);
  }
  const arr = memDb.sections();
  const si = arr.findIndex((s) => s.id === id);
  if (si >= 0) arr.splice(si, 1);
  logAudit('delete', 'section', id, undefined, before);
  return { ok: true };
}

export async function hydrateSectionsFromPg(): Promise<{ hydrated: number }> {
  const rows = await listSections();
  return { hydrated: rows.length };
}

// ─── Subjects ────────────────────────────────────────────────────────────────

type SubjectRow = {
  id: string | number;
  organization_id: string | number;
  name: string;
  subject_code: string | null;
  is_active: boolean;
};

function subjectFromRow(r: SubjectRow): Subject {
  return {
    id: num(r.id),
    organizationId: orgIdFromPg(r.organization_id),
    name: r.name,
    subjectCode: r.subject_code ?? undefined,
    isActive: r.is_active,
  };
}

function mirrorSubject(row: Subject) {
  const arr = memDb.subjects();
  const i = arr.findIndex((s) => s.id === row.id);
  if (i >= 0) arr[i] = row;
  else arr.push(row);
  _ensureNextIdAbove(row.id);
}

async function getSubjectById(id: number): Promise<Subject | null> {
  const r = await dbQuery<SubjectRow>(
    `SELECT id, organization_id, name, subject_code, is_active FROM school_subjects WHERE id = $1`,
    [id],
  );
  return r?.rows[0] ? subjectFromRow(r.rows[0]) : null;
}

export async function listSubjects(organizationId?: number | string): Promise<Subject[]> {
  if (!isDbEnabled()) {
    if (organizationId == null) return [...memDb.subjects()];
    const org = Number(organizationId);
    return memDb.subjects().filter((s) => s.organizationId === org);
  }
  requirePool();
  const sql = organizationId
    ? `SELECT id, organization_id, name, subject_code, is_active FROM school_subjects WHERE organization_id = $1 ORDER BY id`
    : `SELECT id, organization_id, name, subject_code, is_active FROM school_subjects ORDER BY id`;
  const params = organizationId ? [resolveOrgIdForPg(organizationId)] : [];
  const r = await dbQuery<SubjectRow>(sql, params);
  const rows = (r?.rows ?? []).map(subjectFromRow);
  for (const row of rows) mirrorSubject(row);
  return rows;
}

export async function createSubject(input: Omit<Subject, 'id'>): Promise<Subject> {
  requirePool();
  const r = await dbQuery<SubjectRow>(
    `INSERT INTO school_subjects (organization_id, name, subject_code, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING id, organization_id, name, subject_code, is_active`,
    [
      resolveOrgIdForPg(input.organizationId),
      input.name.trim(),
      input.subjectCode ?? null,
      input.isActive ?? true,
    ],
  );
  if (!r?.rows[0]) throw new Error('Failed to create subject');
  const row = subjectFromRow(r.rows[0]);
  mirrorSubject(row);
  return row;
}

export type PatchSubjectInput = Partial<Pick<Subject, 'name' | 'subjectCode' | 'isActive'>>;

export async function patchSubject(id: number, patch: PatchSubjectInput): Promise<Subject> {
  requirePool();
  if (patch.name !== undefined && !String(patch.name).trim()) throw new Error('Name required');
  const before = await getSubjectById(id);
  if (!before) throw new Error('Subject not found');

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (patch.name !== undefined) {
    sets.push(`name = $${idx++}`);
    params.push(patch.name.trim());
  }
  if (patch.subjectCode !== undefined) {
    sets.push(`subject_code = $${idx++}`);
    params.push(patch.subjectCode ?? null);
  }
  if (patch.isActive !== undefined) {
    sets.push(`is_active = $${idx++}`);
    params.push(patch.isActive);
  }
  if (!sets.length) return before;
  params.push(id);

  const r = await dbQuery<SubjectRow>(
    `UPDATE school_subjects SET ${sets.join(', ')} WHERE id = $${idx}
     RETURNING id, organization_id, name, subject_code, is_active`,
    params,
  );
  if (!r?.rows[0]) throw new Error('Subject not found');
  const row = subjectFromRow(r.rows[0]);
  mirrorSubject(row);
  logAudit('update', 'subject', id, row, before);
  return row;
}

export async function deleteSubject(id: number): Promise<{ ok: true }> {
  requirePool();
  const existing = await dbQuery<SubjectRow>(
    `SELECT id, organization_id, name, subject_code, is_active FROM school_subjects WHERE id = $1`,
    [id],
  );
  if (!existing?.rows[0]) throw new Error('Subject not found');
  const before = subjectFromRow(existing.rows[0]);

  await dbQuery(`DELETE FROM school_timetable_entries WHERE subject_id = $1`, [id]);
  const del = await dbQuery(`DELETE FROM school_subjects WHERE id = $1 RETURNING id`, [id]);
  if ((del?.rowCount ?? 0) === 0) throw new Error('Subject not found');

  const timetable = memDb.timetable();
  for (let i = timetable.length - 1; i >= 0; i--) {
    if (timetable[i].subjectId === id) timetable.splice(i, 1);
  }
  const arr = memDb.subjects();
  const i = arr.findIndex((s) => s.id === id);
  if (i >= 0) arr.splice(i, 1);
  logAudit('delete', 'subject', id, undefined, before);
  return { ok: true };
}

export async function hydrateSubjectsFromPg(): Promise<{ hydrated: number }> {
  const rows = await listSubjects();
  return { hydrated: rows.length };
}

// ─── Teachers ────────────────────────────────────────────────────────────────

type TeacherRow = {
  id: string | number;
  organization_id: string | number;
  employee_code: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
};

function teacherFromRow(r: TeacherRow): Teacher {
  return {
    id: num(r.id),
    organizationId: orgIdFromPg(r.organization_id),
    employeeCode: r.employee_code ?? undefined,
    name: r.name,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    isActive: r.is_active,
  };
}

function mirrorTeacher(row: Teacher) {
  const arr = memDb.teachers();
  const i = arr.findIndex((t) => t.id === row.id);
  if (i >= 0) arr[i] = row;
  else arr.push(row);
  _ensureNextIdAbove(row.id);
}

async function getTeacherById(id: number): Promise<Teacher | null> {
  const r = await dbQuery<TeacherRow>(
    `SELECT id, organization_id, employee_code, name, email, phone, is_active FROM school_teachers WHERE id = $1`,
    [id],
  );
  return r?.rows[0] ? teacherFromRow(r.rows[0]) : null;
}

export async function listTeachers(organizationId?: number | string): Promise<Teacher[]> {
  if (!isDbEnabled()) {
    if (organizationId == null) return [...memDb.teachers()];
    const org = Number(organizationId);
    return memDb.teachers().filter((t) => t.organizationId === org);
  }
  requirePool();
  const sql = organizationId
    ? `SELECT id, organization_id, employee_code, name, email, phone, is_active FROM school_teachers WHERE organization_id = $1 ORDER BY id`
    : `SELECT id, organization_id, employee_code, name, email, phone, is_active FROM school_teachers ORDER BY id`;
  const params = organizationId ? [resolveOrgIdForPg(organizationId)] : [];
  const r = await dbQuery<TeacherRow>(sql, params);
  const rows = (r?.rows ?? []).map(teacherFromRow);
  for (const row of rows) mirrorTeacher(row);
  return rows;
}

export async function createTeacher(input: Omit<Teacher, 'id'>): Promise<Teacher> {
  requirePool();
  const r = await dbQuery<TeacherRow>(
    `INSERT INTO school_teachers (organization_id, employee_code, name, email, phone, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, organization_id, employee_code, name, email, phone, is_active`,
    [
      resolveOrgIdForPg(input.organizationId),
      input.employeeCode ?? null,
      input.name.trim(),
      input.email ?? null,
      input.phone ?? null,
      input.isActive ?? true,
    ],
  );
  if (!r?.rows[0]) throw new Error('Failed to create teacher');
  const row = teacherFromRow(r.rows[0]);
  mirrorTeacher(row);
  return row;
}

export type PatchTeacherInput = Partial<Pick<Teacher, 'employeeCode' | 'name' | 'email' | 'phone' | 'isActive'>>;

export async function patchTeacher(id: number, patch: PatchTeacherInput): Promise<Teacher> {
  requirePool();
  if (patch.name !== undefined && !String(patch.name).trim()) throw new Error('Name required');
  const before = await getTeacherById(id);
  if (!before) throw new Error('Teacher not found');

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (patch.employeeCode !== undefined) {
    sets.push(`employee_code = $${idx++}`);
    params.push(patch.employeeCode ?? null);
  }
  if (patch.name !== undefined) {
    sets.push(`name = $${idx++}`);
    params.push(patch.name.trim());
  }
  if (patch.email !== undefined) {
    sets.push(`email = $${idx++}`);
    params.push(patch.email ?? null);
  }
  if (patch.phone !== undefined) {
    sets.push(`phone = $${idx++}`);
    params.push(patch.phone ?? null);
  }
  if (patch.isActive !== undefined) {
    sets.push(`is_active = $${idx++}`);
    params.push(patch.isActive);
  }
  if (!sets.length) return before;
  params.push(id);

  const r = await dbQuery<TeacherRow>(
    `UPDATE school_teachers SET ${sets.join(', ')} WHERE id = $${idx}
     RETURNING id, organization_id, employee_code, name, email, phone, is_active`,
    params,
  );
  if (!r?.rows[0]) throw new Error('Teacher not found');
  const row = teacherFromRow(r.rows[0]);
  mirrorTeacher(row);
  logAudit('update', 'teacher', id, row, before);
  return row;
}

export async function deleteTeacher(id: number): Promise<{ ok: true }> {
  requirePool();
  const existing = await dbQuery<TeacherRow>(
    `SELECT id, organization_id, employee_code, name, email, phone, is_active FROM school_teachers WHERE id = $1`,
    [id],
  );
  if (!existing?.rows[0]) throw new Error('Teacher not found');
  const before = teacherFromRow(existing.rows[0]);

  await dbQuery(`DELETE FROM school_timetable_entries WHERE teacher_id = $1`, [id]);
  const del = await dbQuery(`DELETE FROM school_teachers WHERE id = $1 RETURNING id`, [id]);
  if ((del?.rowCount ?? 0) === 0) throw new Error('Teacher not found');

  const timetable = memDb.timetable();
  for (let i = timetable.length - 1; i >= 0; i--) {
    if (timetable[i].teacherId === id) timetable.splice(i, 1);
  }
  const arr = memDb.teachers();
  const i = arr.findIndex((t) => t.id === id);
  if (i >= 0) arr.splice(i, 1);
  logAudit('delete', 'teacher', id, undefined, before);
  return { ok: true };
}

export async function hydrateTeachersFromPg(): Promise<{ hydrated: number }> {
  const rows = await listTeachers();
  return { hydrated: rows.length };
}

// ─── Staff ─────────────────────────────────────────────────────────────────────

type StaffRow = {
  id: string | number;
  organization_id: string | number;
  employee_code: string | null;
  name: string;
  role: string;
  phone: string | null;
  is_active: boolean;
};

function staffFromRow(r: StaffRow): StaffMember {
  return {
    id: num(r.id),
    organizationId: orgIdFromPg(r.organization_id),
    employeeCode: r.employee_code ?? undefined,
    name: r.name,
    role: r.role,
    phone: r.phone ?? undefined,
    isActive: r.is_active,
  };
}

function mirrorStaff(row: StaffMember) {
  const arr = memDb.staff();
  const i = arr.findIndex((s) => s.id === row.id);
  if (i >= 0) arr[i] = row;
  else arr.push(row);
  _ensureNextIdAbove(row.id);
}

async function getStaffMemberById(id: number): Promise<StaffMember | null> {
  const r = await dbQuery<StaffRow>(
    `SELECT id, organization_id, employee_code, name, role, phone, is_active FROM school_staff_members WHERE id = $1`,
    [id],
  );
  return r?.rows[0] ? staffFromRow(r.rows[0]) : null;
}

export async function listStaffMembers(organizationId?: number | string): Promise<StaffMember[]> {
  if (!isDbEnabled()) {
    if (organizationId == null) return [...memDb.staff()];
    const org = Number(organizationId);
    return memDb.staff().filter((s) => s.organizationId === org);
  }
  requirePool();
  const sql = organizationId
    ? `SELECT id, organization_id, employee_code, name, role, phone, is_active FROM school_staff_members WHERE organization_id = $1 ORDER BY id`
    : `SELECT id, organization_id, employee_code, name, role, phone, is_active FROM school_staff_members ORDER BY id`;
  const params = organizationId ? [resolveOrgIdForPg(organizationId)] : [];
  const r = await dbQuery<StaffRow>(sql, params);
  const rows = (r?.rows ?? []).map(staffFromRow);
  for (const row of rows) mirrorStaff(row);
  return rows;
}

export async function createStaffMember(input: Omit<StaffMember, 'id'>): Promise<StaffMember> {
  requirePool();
  const r = await dbQuery<StaffRow>(
    `INSERT INTO school_staff_members (organization_id, employee_code, name, role, phone, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, organization_id, employee_code, name, role, phone, is_active`,
    [
      resolveOrgIdForPg(input.organizationId),
      input.employeeCode ?? null,
      input.name.trim(),
      input.role,
      input.phone ?? null,
      input.isActive ?? true,
    ],
  );
  if (!r?.rows[0]) throw new Error('Failed to create staff member');
  const row = staffFromRow(r.rows[0]);
  mirrorStaff(row);
  return row;
}

export type PatchStaffMemberInput = Partial<Pick<StaffMember, 'employeeCode' | 'name' | 'role' | 'phone' | 'isActive'>>;

export async function patchStaffMember(id: number, patch: PatchStaffMemberInput): Promise<StaffMember> {
  requirePool();
  if (patch.name !== undefined && !String(patch.name).trim()) throw new Error('Name required');
  if (patch.role !== undefined && !String(patch.role).trim()) throw new Error('Role required');
  const before = await getStaffMemberById(id);
  if (!before) throw new Error('Staff member not found');

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (patch.employeeCode !== undefined) {
    sets.push(`employee_code = $${idx++}`);
    params.push(patch.employeeCode ?? null);
  }
  if (patch.name !== undefined) {
    sets.push(`name = $${idx++}`);
    params.push(patch.name.trim());
  }
  if (patch.role !== undefined) {
    sets.push(`role = $${idx++}`);
    params.push(patch.role);
  }
  if (patch.phone !== undefined) {
    sets.push(`phone = $${idx++}`);
    params.push(patch.phone ?? null);
  }
  if (patch.isActive !== undefined) {
    sets.push(`is_active = $${idx++}`);
    params.push(patch.isActive);
  }
  if (!sets.length) return before;
  params.push(id);

  const r = await dbQuery<StaffRow>(
    `UPDATE school_staff_members SET ${sets.join(', ')} WHERE id = $${idx}
     RETURNING id, organization_id, employee_code, name, role, phone, is_active`,
    params,
  );
  if (!r?.rows[0]) throw new Error('Staff member not found');
  const row = staffFromRow(r.rows[0]);
  mirrorStaff(row);
  logAudit('update', 'staff_member', id, row, before);
  return row;
}

export async function deleteStaffMember(id: number): Promise<{ ok: true }> {
  requirePool();
  const existing = await dbQuery<StaffRow>(
    `SELECT id, organization_id, employee_code, name, role, phone, is_active FROM school_staff_members WHERE id = $1`,
    [id],
  );
  if (!existing?.rows[0]) throw new Error('Staff member not found');
  const before = staffFromRow(existing.rows[0]);

  await dbQuery(`DELETE FROM school_staff_duty_rosters WHERE staff_member_id = $1`, [id]);
  const del = await dbQuery(`DELETE FROM school_staff_members WHERE id = $1 RETURNING id`, [id]);
  if ((del?.rowCount ?? 0) === 0) throw new Error('Staff member not found');

  const rosters = memDb.rosters();
  for (let i = rosters.length - 1; i >= 0; i--) {
    if (rosters[i].staffMemberId === id) rosters.splice(i, 1);
  }
  const arr = memDb.staff();
  const i = arr.findIndex((s) => s.id === id);
  if (i >= 0) arr.splice(i, 1);
  logAudit('delete', 'staff_member', id, undefined, before);
  return { ok: true };
}

export async function hydrateStaffFromPg(): Promise<{ hydrated: number }> {
  const rows = await listStaffMembers();
  return { hydrated: rows.length };
}
