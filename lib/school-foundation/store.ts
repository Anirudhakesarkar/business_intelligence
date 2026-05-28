import type {
  AuditEntry, Building, CalendarDay, DutyRoster, Floor, Room, SchoolCamera, SchoolClass,
  Section, SetupHealth, Site, StaffMember, Subject, Teacher, TimeWindow, TimetableEntry, Zone,
} from './types';

let nextId = 1;
const nid = () => nextId++;

const sites: Site[] = [];
const buildings: Building[] = [];
const floors: Floor[] = [];
const zones: Zone[] = [];
const rooms: Room[] = [];
const cameras: SchoolCamera[] = [];
const classes: SchoolClass[] = [];
const sections: Section[] = [];
const subjects: Subject[] = [];
const teachers: Teacher[] = [];
const staff: StaffMember[] = [];
const calendar: CalendarDay[] = [];
const timeWindows: TimeWindow[] = [];
const timetable: TimetableEntry[] = [];
const rosters: DutyRoster[] = [];
const sectionRoomMappings: import('./types').SectionRoomMapping[] = [];
const auditLog: AuditEntry[] = [];
let currentActorId: number | undefined;
let currentAuditMeta: { ipAddress?: string; userAgent?: string } = {};

export function setAuditRequestMeta(meta?: { ipAddress?: string; userAgent?: string }) {
  currentAuditMeta = meta ?? {};
}

export function setAuditActor(actorId?: number) {
  currentActorId = actorId;
}

export function logAudit(action: string, entityType: string, entityId?: number, after?: unknown, before?: unknown) {
  auditLog.push({ id: nid(), actorId: currentActorId, action, entityType, entityId, beforeData: before, afterData: after, createdAt: new Date().toISOString(), ipAddress: currentAuditMeta.ipAddress, userAgent: currentAuditMeta.userAgent });
}

export const db = {
  sites: () => sites, buildings: () => buildings, floors: () => floors, zones: () => zones, rooms: () => rooms,
  cameras: () => cameras, classes: () => classes, sections: () => sections, subjects: () => subjects,
  teachers: () => teachers, staff: () => staff, calendar: () => calendar, timeWindows: () => timeWindows,
  timetable: () => timetable, rosters: () => rosters, sectionRoomMappings: () => sectionRoomMappings, auditLog: () => auditLog,
};

/**
 * Internal: bump nextId past a known PG-assigned id when mirroring PG rows into the
 * in-memory cache so future in-memory createX calls don't collide with PG ids.
 *
 * This exists ONLY for the transitional period while repos are being migrated to PG.
 * Once all entities are PG-backed, the in-memory store (and this helper) can be deleted.
 */
export function _ensureNextIdAbove(id: number) {
  if (id >= nextId) nextId = id + 1;
}

export function createSite(input: Omit<Site, 'id'>) {
  const row: Site = { ...input, id: nid() };
  sites.push(row);
  logAudit('create', 'site', row.id, row);
  return row;
}

export function patchSite(id: number, patch: Partial<Pick<Site, 'name' | 'address' | 'isActive'>>) {
  const i = sites.findIndex((s) => s.id === id);
  if (i < 0) throw new Error('Site not found');
  if (patch.name !== undefined && !String(patch.name).trim()) {
    throw new Error('Name required');
  }
  const before = { ...sites[i] };
  const next: Site = {
    ...sites[i],
    ...patch,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
  };
  sites[i] = next;
  logAudit('update', 'site', id, next, before);
  return next;
}

export function createBuilding(input: Omit<Building, 'id'>) {
  const row: Building = { ...input, id: nid() };
  buildings.push(row);
  logAudit('create', 'building', row.id, row);
  return row;
}

export function createFloor(input: Omit<Floor, 'id'>) {
  const row: Floor = { ...input, id: nid() };
  floors.push(row);
  logAudit('create', 'floor', row.id, row);
  return row;
}

export function createZone(input: Omit<Zone, 'id'>) {
  const row: Zone = { ...input, id: nid() };
  zones.push(row);
  logAudit('create', 'zone', row.id, row);
  return row;
}

export function createRoom(input: Omit<Room, 'id'>) {
  if (input.capacity < 1) throw new Error('Room capacity must be at least 1.');
  const row: Room = { ...input, id: nid() };
  rooms.push(row);
  logAudit('create', 'room', row.id, row);
  return row;
}

export function listZonesForOrganization(organizationId: number) {
  const siteIds = sites.filter((s) => s.organizationId === organizationId).map((s) => s.id);
  const buildingIds = buildings.filter((b) => siteIds.includes(b.siteId)).map((b) => b.id);
  const floorIds = floors.filter((f) => buildingIds.includes(f.buildingId)).map((f) => f.id);
  return zones.filter((z) => z.floorId && floorIds.includes(z.floorId));
}

export function listRooms(organizationId?: number) {
  if (!organizationId) return [...rooms];
  const zoneIds = listZonesForOrganization(organizationId).map((z) => z.id);
  return rooms.filter((r) => r.zoneId && zoneIds.includes(r.zoneId));
}

export function createCamera(input: Omit<SchoolCamera, 'id'>) {
  if (!input.zoneId && !input.roomId) throw new Error('Camera must be mapped to at least a zone or room.');
  if ((input.purpose === 'Classroom' || input.purpose === 'Lab') && !input.roomId) {
    throw new Error('Classroom and lab cameras must be mapped to a room.');
  }
  if (input.activeFrom && input.activeTo && input.activeTo <= input.activeFrom) {
    throw new Error('Camera active end time must be after start time.');
  }
  if (cameras.some((c) => c.cameraCode === input.cameraCode)) throw new Error('Camera code already exists.');
  const row: SchoolCamera = { ...input, id: nid(), status: input.status ?? 'Active' };
  cameras.push(row);
  logAudit('create', 'camera', row.id, row);
  return row;
}

export function patchCamera(id: number, patch: Partial<SchoolCamera>) {
  const i = cameras.findIndex((c) => c.id === id);
  if (i < 0) throw new Error('Camera not found');
  const merged = { ...cameras[i], ...patch };
  if (!merged.zoneId && !merged.roomId) throw new Error('Camera must be mapped to at least a zone or room.');
  if ((merged.purpose === 'Classroom' || merged.purpose === 'Lab') && !merged.roomId) {
    throw new Error('Classroom and lab cameras must be mapped to a room.');
  }
  const before = cameras[i];
  cameras[i] = merged;
  logAudit('update', 'camera', id, merged, before);
  return merged;
}

export function deactivateCamera(id: number) {
  const i = cameras.findIndex((c) => c.id === id);
  if (i < 0) throw new Error('Camera not found');
  const before = cameras[i];
  const row = { ...before, status: 'Inactive' as const };
  cameras[i] = row;
  logAudit('update', 'camera', id, row, before);
  return row;
}

export function purgeCamera(id: number): { id: number; purged: true } {
  const i = cameras.findIndex((c) => c.id === id);
  if (i < 0) throw new Error('Camera not found');
  const before = cameras[i];
  cameras.splice(i, 1);
  logAudit('delete', 'camera', id, undefined, before);
  return { id, purged: true };
}

export function createClass(input: Omit<SchoolClass, 'id'>) {
  const row: SchoolClass = { ...input, id: nid() };
  classes.push(row);
  return row;
}

export function createSection(input: Omit<Section, 'id'>) {
  const row: Section = { ...input, id: nid() };
  sections.push(row);
  return row;
}

export function patchSection(id: number, patch: Partial<Pick<Section, 'name' | 'expectedStudentCount' | 'isActive'>>) {
  const row = sections.find((s) => s.id === id);
  if (!row) throw new Error('Section not found');
  if (patch.expectedStudentCount != null && patch.expectedStudentCount < 1) {
    throw new Error('expectedStudentCount must be at least 1');
  }
  Object.assign(row, patch);
  logAudit('update', 'section', id, row);
  return row;
}

export function getSection(id: number) {
  const row = sections.find((s) => s.id === id);
  if (!row) throw new Error('Section not found');
  return row;
}

export function createSubject(input: Omit<Subject, 'id'>) {
  const row: Subject = { ...input, id: nid() };
  subjects.push(row);
  return row;
}

export function createTeacher(input: Omit<Teacher, 'id'>) {
  const row: Teacher = { ...input, id: nid() };
  teachers.push(row);
  return row;
}

export function createStaff(input: Omit<StaffMember, 'id'>) {
  const row: StaffMember = { ...input, id: nid() };
  staff.push(row);
  return row;
}


function removeTimetableByRoom(roomId: number) {
  for (let i = timetable.length - 1; i >= 0; i--) {
    if (timetable[i].roomId === roomId) timetable.splice(i, 1);
  }
}

function removeTimetableBySection(sectionId: number) {
  for (let i = timetable.length - 1; i >= 0; i--) {
    if (timetable[i].sectionId === sectionId) timetable.splice(i, 1);
  }
}

function removeTimetableBySubject(subjectId: number) {
  for (let i = timetable.length - 1; i >= 0; i--) {
    if (timetable[i].subjectId === subjectId) timetable.splice(i, 1);
  }
}

function removeTimetableByTeacher(teacherId: number) {
  for (let i = timetable.length - 1; i >= 0; i--) {
    if (timetable[i].teacherId === teacherId) timetable.splice(i, 1);
  }
}

export function deleteSite(id: number) {
  const site = sites.find((s) => s.id === id);
  if (!site) throw new Error('Site not found');
  const bIds = buildings.filter((b) => b.siteId === id).map((b) => b.id);
  for (const bid of bIds) deleteBuilding(bid);
  const idx = sites.findIndex((s) => s.id === id);
  sites.splice(idx, 1);
  logAudit('delete', 'site', id, undefined, site);
  return { ok: true as const };
}

export function deleteBuilding(id: number) {
  const row = buildings.find((b) => b.id === id);
  if (!row) throw new Error('Building not found');
  const fIds = floors.filter((f) => f.buildingId === id).map((f) => f.id);
  for (const fid of fIds) deleteFloor(fid);
  const idx = buildings.findIndex((b) => b.id === id);
  buildings.splice(idx, 1);
  logAudit('delete', 'building', id, undefined, row);
  return { ok: true as const };
}

export function deleteFloor(id: number) {
  const row = floors.find((f) => f.id === id);
  if (!row) throw new Error('Floor not found');
  const zIds = zones.filter((z) => z.floorId === id).map((z) => z.id);
  for (const zid of zIds) deleteZone(zid);
  const idx = floors.findIndex((f) => f.id === id);
  floors.splice(idx, 1);
  logAudit('delete', 'floor', id, undefined, row);
  return { ok: true as const };
}

export function deleteZone(id: number) {
  const row = zones.find((z) => z.id === id);
  if (!row) throw new Error('Zone not found');
  const roomIds = rooms.filter((r) => r.zoneId === id).map((r) => r.id);
  for (const rid of roomIds) deleteRoom(rid);
  for (let i = rosters.length - 1; i >= 0; i--) {
    if (rosters[i].zoneId === id) rosters.splice(i, 1);
  }
  for (const cam of cameras) {
    if (cam.zoneId === id) {
      if (!cam.roomId) {
        throw new Error(
          `Camera "${cam.cameraCode}" is mapped only to this zone. Map it to a room or delete the camera first.`,
        );
      }
      cam.zoneId = undefined;
    }
  }
  const idx = zones.findIndex((z) => z.id === id);
  zones.splice(idx, 1);
  logAudit('delete', 'zone', id, undefined, row);
  return { ok: true as const };
}

export function deleteRoom(id: number) {
  const row = rooms.find((r) => r.id === id);
  if (!row) throw new Error('Room not found');
  if (cameras.some((c) => c.roomId === id)) {
    throw new Error('Unmap or delete cameras that use this room first.');
  }
  removeTimetableByRoom(id);
  for (let i = sectionRoomMappings.length - 1; i >= 0; i--) {
    if (sectionRoomMappings[i].roomId === id) sectionRoomMappings.splice(i, 1);
  }
  const idx = rooms.findIndex((r) => r.id === id);
  rooms.splice(idx, 1);
  logAudit('delete', 'room', id, undefined, row);
  return { ok: true as const };
}

export function deleteClass(id: number) {
  const row = classes.find((c) => c.id === id);
  if (!row) throw new Error('Class not found');
  const sIds = sections.filter((s) => s.classId === id).map((s) => s.id);
  for (const sid of sIds) deleteSection(sid);
  const idx = classes.findIndex((c) => c.id === id);
  classes.splice(idx, 1);
  logAudit('delete', 'class', id, undefined, row);
  return { ok: true as const };
}

export function deleteSection(id: number) {
  const row = sections.find((s) => s.id === id);
  if (!row) throw new Error('Section not found');
  removeTimetableBySection(id);
  for (let i = sectionRoomMappings.length - 1; i >= 0; i--) {
    if (sectionRoomMappings[i].sectionId === id) sectionRoomMappings.splice(i, 1);
  }
  const idx = sections.findIndex((s) => s.id === id);
  sections.splice(idx, 1);
  logAudit('delete', 'section', id, undefined, row);
  return { ok: true as const };
}

export function deleteSubject(id: number) {
  const row = subjects.find((s) => s.id === id);
  if (!row) throw new Error('Subject not found');
  removeTimetableBySubject(id);
  const idx = subjects.findIndex((s) => s.id === id);
  subjects.splice(idx, 1);
  logAudit('delete', 'subject', id, undefined, row);
  return { ok: true as const };
}

export function deleteTeacher(id: number) {
  const row = teachers.find((t) => t.id === id);
  if (!row) throw new Error('Teacher not found');
  removeTimetableByTeacher(id);
  const idx = teachers.findIndex((t) => t.id === id);
  teachers.splice(idx, 1);
  logAudit('delete', 'teacher', id, undefined, row);
  return { ok: true as const };
}

export function deleteStaffMember(id: number) {
  const row = staff.find((s) => s.id === id);
  if (!row) throw new Error('Staff member not found');
  for (let i = rosters.length - 1; i >= 0; i--) {
    if (rosters[i].staffMemberId === id) rosters.splice(i, 1);
  }
  const idx = staff.findIndex((s) => s.id === id);
  staff.splice(idx, 1);
  logAudit('delete', 'staff_member', id, undefined, row);
  return { ok: true as const };
}

export function createCalendarDay(input: Omit<CalendarDay, 'id'>) {
  const existing = calendar.find((c) => c.organizationId === input.organizationId && c.calendarDate === input.calendarDate);
  if (existing) {
    const before = { ...existing };
    Object.assign(existing, input);
    logAudit('update', 'school_calendar', existing.id, existing, before);
    return existing;
  }
  const row: CalendarDay = { ...input, id: nid() };
  calendar.push(row);
  logAudit('create', 'school_calendar', row.id, row);
  return row;
}

export function createTimeWindow(input: Omit<TimeWindow, 'id'>) {
  if (input.endTime <= input.startTime) throw new Error('End time must be after start time.');
  const row: TimeWindow = { ...input, id: nid() };
  timeWindows.push(row);
  return row;
}

function periodsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

export function createTimetableEntry(input: Omit<TimetableEntry, 'id' | 'isActive'>) {
  if (input.endTime <= input.startTime) throw new Error('End time must be after start time.');
  const roomConflict = timetable.some(
    (t) => t.isActive && t.roomId === input.roomId && t.dayOfWeek === input.dayOfWeek &&
      periodsOverlap(t.startTime, t.endTime, input.startTime, input.endTime)
  );
  if (roomConflict) throw new Error('Room has overlapping timetable period.');
  const row: TimetableEntry = { ...input, id: nid(), isActive: true };
  timetable.push(row);
  logAudit('create', 'timetable', row.id, row);
  return row;
}

export function deactivateTimetable(id: number) {
  const t = timetable.find((x) => x.id === id);
  if (!t) throw new Error('Not found');
  t.isActive = false;
  return t;
}

export function patchTimetableEntry(
  id: number,
  patch: Partial<Pick<TimetableEntry, 'sectionId' | 'subjectId' | 'roomId' | 'teacherId' | 'periodType' | 'dayOfWeek' | 'startTime' | 'endTime'>>,
) {
  const i = timetable.findIndex((t) => t.id === id);
  if (i < 0) throw new Error('Not found');
  const merged = { ...timetable[i], ...patch };
  if (merged.endTime <= merged.startTime) throw new Error('End time must be after start time.');
  const roomConflict = timetable.some(
    (t) =>
      t.isActive &&
      t.id !== id &&
      t.roomId === merged.roomId &&
      t.dayOfWeek === merged.dayOfWeek &&
      periodsOverlap(t.startTime, t.endTime, merged.startTime, merged.endTime),
  );
  if (roomConflict) throw new Error('Room has overlapping timetable period.');
  const before = timetable[i];
  timetable[i] = merged;
  logAudit('update', 'timetable', id, merged, before);
  return merged;
}

export function createDutyRoster(input: Omit<DutyRoster, 'id' | 'isActive'>) {
  if (input.endTime <= input.startTime) throw new Error('End time must be after start time.');
  const row: DutyRoster = { ...input, id: nid(), isActive: true };
  rosters.push(row);
  logAudit('create', 'duty_roster', row.id, row);
  return row;
}


export function getSectionRoomMapping(sectionId: number) {
  const primary = sectionRoomMappings.find((m) => m.sectionId === sectionId && m.isPrimary);
  if (primary) return { sectionId, roomId: primary.roomId, isPrimary: true, mappingId: primary.id };
  const any = sectionRoomMappings.find((m) => m.sectionId === sectionId);
  if (any) return { sectionId, roomId: any.roomId, isPrimary: any.isPrimary, mappingId: any.id };
  const tt = timetable.find((t) => t.isActive && t.sectionId === sectionId);
  if (tt) return { sectionId, roomId: tt.roomId, isPrimary: true, mappingId: null, source: 'timetable' as const };
  return null;
}

export function listSectionRoomMappings(sectionId: number) {
  return sectionRoomMappings.filter((m) => m.sectionId === sectionId);
}

export function setSectionRoomMapping(sectionId: number, roomId: number, isPrimary = true) {
  const section = sections.find((x) => x.id === sectionId);
  if (!section) throw new Error('Section not found');
  const room = rooms.find((r) => r.id === roomId);
  if (!room) throw new Error('Room not found');
  if (isPrimary) {
    for (const m of sectionRoomMappings) {
      if (m.sectionId === sectionId) m.isPrimary = false;
    }
  }
  const existing = sectionRoomMappings.find((m) => m.sectionId === sectionId && m.roomId === roomId);
  if (existing) {
    existing.isPrimary = isPrimary;
    logAudit('update', 'section_room_mapping', existing.id, existing);
    return existing;
  }
  const row: import('./types').SectionRoomMapping = {
    id: nid(), sectionId, roomId, isPrimary, createdAt: new Date().toISOString(),
  };
  sectionRoomMappings.push(row);
  logAudit('create', 'section_room_mapping', row.id, row);
  return row;
}

export function syncSectionRoomMappingsFromTimetable(organizationId: number) {
  const orgClassIds = classes.filter((c) => c.organizationId === organizationId).map((c) => c.id);
  const orgSections = sections.filter((sec) => orgClassIds.includes(sec.classId));
  let created = 0;
  for (const sec of orgSections) {
    if (sectionRoomMappings.some((m) => m.sectionId === sec.id && m.isPrimary)) continue;
    const tt = timetable.find((t) => t.isActive && t.sectionId === sec.id);
    if (!tt) continue;
    setSectionRoomMapping(sec.id, tt.roomId, true);
    created++;
  }
  return { created, total: orgSections.length };
}



export function getCalendarSummary(organizationId: number): import('./types').CalendarSummary {
  const cal = calendar.filter((c) => c.organizationId === organizationId);
  const count = (t: string) => cal.filter((c) => c.dayType === t).length;
  return {
    totalDays: cal.length,
    workingDays: count('WorkingDay'),
    holidays: count('Holiday'),
    examDays: count('Exam'),
    eventDays: count('Event'),
    halfDays: count('HalfDay'),
    specialDays: count('Special'),
  };
}

export function getNextSetupAction(organizationId: number): import('./types').SetupNextAction | null {
  const activeCameras = cameras.filter((c) => c.organizationId === organizationId && c.status === 'Active');
  const mapped = activeCameras.filter((c) => c.zoneId || c.roomId);
  const orgRooms = listRooms(organizationId);
  const roomsWithCap = orgRooms.filter((r) => r.capacity > 0);
  const tt = timetable.filter((t) => t.organizationId === organizationId && t.isActive);
  const rr = rosters.filter((r) => r.organizationId === organizationId && r.isActive);
  const cal = calendar.filter((c) => c.organizationId === organizationId);

  if (activeCameras.length === 0) {
    return { label: 'Register cameras', href: '/dashboard/school-management/cameras', reason: 'Add at least one active camera to begin mapping.' };
  }
  if (mapped.length < activeCameras.length) {
    return { label: 'Map cameras to locations', href: '/dashboard/school-management/cameras', reason: `${activeCameras.length - mapped.length} active camera(s) still need zone or room mapping.` };
  }
  if (orgRooms.length === 0 || roomsWithCap.length < orgRooms.length) {
    return { label: 'Configure rooms', href: '/dashboard/school-management/master-data', reason: 'Set room capacity and hierarchy before timetable and occupancy modules.' };
  }
  if (tt.length === 0) {
    return { label: 'Build timetable', href: '/dashboard/school-management/timetable', reason: 'Timetable entries link classes, teachers, and rooms for intelligence modules.' };
  }
  if (rr.length === 0) {
    return { label: 'Assign duty roster', href: '/dashboard/school-management/staff-duty', reason: 'Staff duty roster covers gate and corridor supervision windows.' };
  }
  if (cal.length < 30) {
    return { label: 'Complete school calendar', href: '/dashboard/school-management/calendar', reason: 'Add at least 30 calendar days including holidays and exam periods.' };
  }
  const gateZones = listZonesForOrganization(organizationId).filter((z) => z.zoneType.toLowerCase().includes('gate'));
  const criticalGate = rosters.filter((r) => r.organizationId === organizationId && r.isCriticalWindow && r.isActive);
  if (gateZones.length > 0 && criticalGate.length === 0) {
    return { label: 'Assign critical gate duty', href: '/dashboard/school-management/staff-duty', reason: 'Critical gate windows need staffed duty roster entries.' };
  }
  return null;
}

export function getSetupHealth(organizationId: number): SetupHealth {
  const activeCameras = cameras.filter((c) => c.organizationId === organizationId && c.status === 'Active');
  const mapped = activeCameras.filter((c) => c.zoneId || c.roomId);
  const orgRooms = listRooms(organizationId);
  const roomsWithCap = orgRooms.filter((r) => r.capacity > 0);
  const tt = timetable.filter((t) => t.organizationId === organizationId && t.isActive);
  const rr = rosters.filter((r) => r.organizationId === organizationId && r.isActive);
  const cal = calendar.filter((c) => c.organizationId === organizationId);
  const missing: string[] = [];
  if (activeCameras.length === 0) missing.push('Register at least one active camera');
  if (mapped.length < activeCameras.length) missing.push('Map all active cameras to zone or room');
  if (orgRooms.length === 0) missing.push('Configure rooms with capacity');
  if (roomsWithCap.length < orgRooms.length) missing.push('Set capacity on all rooms');
  if (tt.length === 0) missing.push('Add timetable entries');
  if (rr.length === 0) missing.push('Add staff duty roster entries');
  if (cal.length < 30) missing.push('Add at least 30 calendar days');
  const orgZones = listZonesForOrganization(organizationId);
  const gateZones = orgZones.filter((z) => z.zoneType.toLowerCase().includes('gate'));
  const criticalGate = rosters.filter((r) => r.organizationId === organizationId && r.isCriticalWindow && r.isActive);
  if (gateZones.length > 0 && criticalGate.length === 0) missing.push('Assign critical gate duty staff');
  const riskWithoutCamera = orgZones.filter((z) => z.isRiskZone && !cameras.some((c) => c.zoneId === z.id && c.organizationId === organizationId));
  if (riskWithoutCamera.length) missing.push(`${riskWithoutCamera.length} risk zone(s) without camera coverage`);
  const playgroundZones = orgZones.filter((z) => z.isRiskZone && (z.riskCategory === 'Playground' || z.zoneType.toLowerCase().includes('playground')));
  const playgroundWaiver = getComplianceConfig(organizationId).playgroundCameraWaiver === true;
  for (const pz of playgroundZones) {
    const hasCam = cameras.some((c) => c.organizationId === organizationId && c.zoneId === pz.id && c.status === 'Active');
    if (!hasCam && !playgroundWaiver) missing.push(`Playground zone "${pz.name}" has no camera (set waiver in compliance config if intentional)`);
  }
  const orgClassIds = classes.filter((c) => c.organizationId === organizationId).map((c) => c.id);
  const orgSections = sections.filter((sec) => orgClassIds.includes(sec.classId) && sec.isActive);
  const missingCount = orgSections.filter((sec) => !sec.expectedStudentCount || sec.expectedStudentCount < 1);
  if (missingCount.length) missing.push(`${missingCount.length} section(s) missing expected student count`);
  const unmapped = orgSections.filter((sec) => !getSectionRoomMapping(sec.id));
  if (unmapped.length) missing.push(`${unmapped.length} section(s) without room mapping`);
  const checks = [
    activeCameras.length > 0,
    mapped.length === activeCameras.length && activeCameras.length > 0,
    orgRooms.length > 0 && roomsWithCap.length === orgRooms.length,
    tt.length > 0,
    rr.length > 0,
    cal.length >= 30,
  ];
  const dedupedMissing = [...new Set(missing)];
  const checksPercent = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const isReadyForPhase2 = checks.every(Boolean) && dedupedMissing.length === 0;
  const completionPercent = isReadyForPhase2
    ? 100
    : dedupedMissing.length > 0
      ? Math.min(checksPercent, 99)
      : checksPercent;
  const nextAction = getNextSetupAction(organizationId);
  return {
    completionPercent,
    camerasMapped: { complete: mapped.length, total: activeCameras.length },
    roomsConfigured: { complete: roomsWithCap.length, total: orgRooms.length },
    timetableEntries: tt.length,
    rosterEntries: rr.length,
    calendarDays: cal.length,
    isReadyForPhase2,
    missing: dedupedMissing,
    nextAction,
    calendarSummary: getCalendarSummary(organizationId),
  };
}

export function getMissingData(organizationId: number) {
  const health = getSetupHealth(organizationId);
  const unmapped = cameras.filter(
    (c) => c.organizationId === organizationId && c.status === 'Active' && !c.zoneId && !c.roomId
  );
  return { ...health, unmappedCameras: unmapped.map((c) => c.cameraCode) };
}

export function getMappingStatus(organizationId: number) {
  const active = cameras.filter((c) => c.organizationId === organizationId && c.status === 'Active');
  const mapped = active.filter((c) => c.zoneId || c.roomId);
  return { total: active.length, mapped: mapped.length, percent: active.length ? Math.round((mapped.length / active.length) * 100) : 0 };
}



const complianceByOrg = new Map<number, import('./types').ComplianceConfig>();

export function getComplianceConfig(organizationId: number): import('./types').ComplianceConfig {
  let row = complianceByOrg.get(organizationId);
  if (!row) {
    const restricted = zones.filter((z) => z.isRiskZone).map((z) => z.id);
    row = {
      organizationId,
      safetyRules: ['No running in corridors during class hours', 'Fire exits must remain clear'],
      restrictedZoneIds: restricted,
      auditChecklist: [
        { id: 'c1', label: 'Critical cameras online', required: true },
        { id: 'c2', label: 'Gate duty roster assigned', required: true },
        { id: 'c3', label: 'Lab supervision policy active', required: false },
      ],
      updatedAt: new Date().toISOString(),
    };
    complianceByOrg.set(organizationId, row);
  }
  return row;
}

export function patchComplianceConfig(organizationId: number, patch: Partial<import('./types').ComplianceConfig>) {
  const row = { ...getComplianceConfig(organizationId), ...patch, organizationId, updatedAt: new Date().toISOString() };
  complianceByOrg.set(organizationId, row);
  logAudit('update', 'compliance_config', organizationId, row);
  return row;
}

export function setTeachingZones(cameraId: number, zones: import('./types').TeachingZones) {
  const cam = cameras.find((c) => c.id === cameraId);
  if (!cam) throw new Error('Camera not found');
  const meta = { ...(cam.metadata ?? {}), teachingZones: zones };
  return patchCamera(cameraId, { metadata: meta });
}

export type ImportCameraRow = {
  cameraCode: string;
  name: string;
  purpose: import('./types').CameraPurpose;
  processOwner: import('./types').ProcessOwner;
  criticality?: import('./types').Criticality;
  zoneId?: number;
  roomId?: number;
  streamUrl?: string;
};

export function importCameras(organizationId: number, rows: ImportCameraRow[]) {
  const created: SchoolCamera[] = [];
  const errors: { row: number; message: string }[] = [];
  rows.forEach((row, i) => {
    try {
      created.push(
        createCamera({
          organizationId,
          cameraCode: row.cameraCode,
          name: row.name,
          streamUrl: row.streamUrl ?? `rtsp://demo/${row.cameraCode}`,
          purpose: row.purpose,
          processOwner: row.processOwner,
          criticality: row.criticality ?? 'Medium',
          zoneId: row.zoneId,
          roomId: row.roomId,
          status: 'Active',
        })
      );
    } catch (e) {
      errors.push({ row: i + 1, message: (e as Error).message });
    }
  });
  return { created: created.length, errors };
}

export type TimetableImportRow = {
  sectionId: number;
  roomId: number;
  teacherId?: number;
  subjectId?: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  periodType?: string;
};

export function validateTimetableImport(organizationId: number, rows: TimetableImportRow[]) {
  const errors: { row: number; message: string }[] = [];
  const slots: { roomId: number; dayOfWeek: number; start: string; end: string; row: number }[] = [];
  rows.forEach((row, i) => {
    if (row.endTime <= row.startTime) errors.push({ row: i + 1, message: 'End time must be after start time' });
    if (!rooms.find((r) => r.id === row.roomId)) errors.push({ row: i + 1, message: 'Invalid roomId' });
    slots.push({ roomId: row.roomId, dayOfWeek: row.dayOfWeek, start: row.startTime, end: row.endTime, row: i + 1 });
  });
  for (let a = 0; a < slots.length; a++) {
    for (let b = a + 1; b < slots.length; b++) {
      const x = slots[a];
      const y = slots[b];
      if (x.roomId === y.roomId && x.dayOfWeek === y.dayOfWeek && x.start < y.end && y.start < x.end) {
        errors.push({ row: y.row, message: `Overlaps row ${x.row} in same room` });
      }
    }
  }
  const existing = timetable.filter((t) => t.organizationId === organizationId && t.isActive);
  return { valid: errors.length === 0, errors, previewCount: rows.length, existingCount: existing.length };
}

export function commitTimetableImport(organizationId: number, rows: TimetableImportRow[]) {
  const v = validateTimetableImport(organizationId, rows);
  if (!v.valid) throw new Error('Validation failed');
  const created = rows.map((r) =>
    createTimetableEntry({
      organizationId,
      sectionId: r.sectionId,
      roomId: r.roomId,
      teacherId: r.teacherId,
      subjectId: r.subjectId,
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
      periodType: r.periodType ?? 'Class',
    })
  );
  return { created: created.length };
}

export function resetStoreForSeed() {
  sites.length = 0; buildings.length = 0; floors.length = 0; zones.length = 0; rooms.length = 0;
  cameras.length = 0; classes.length = 0; sections.length = 0; subjects.length = 0;
  teachers.length = 0; staff.length = 0; calendar.length = 0; timeWindows.length = 0;
  timetable.length = 0; rosters.length = 0; sectionRoomMappings.length = 0; auditLog.length = 0;
  complianceByOrg.clear();
  nextId = 1;
}
