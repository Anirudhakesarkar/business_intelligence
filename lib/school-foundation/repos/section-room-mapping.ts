import type { SectionRoomMapping } from '../types';
import { db as memDb, logAudit, setSectionRoomMapping as setSectionRoomMappingMem, _ensureNextIdAbove } from '../store';
import { dbQuery, isDbEnabled, num, requirePool, withDbTransaction } from './shared';

type MappingRow = {
  id: string | number;
  section_id: string | number;
  room_id: string | number;
  is_primary: boolean;
  created_at: string | Date;
};

export type SectionRoomMappingView = {
  sectionId: number;
  roomId: number;
  isPrimary: boolean;
  mappingId: number | null;
  source?: 'timetable';
};

function mappingFromRow(r: MappingRow): SectionRoomMapping {
  const createdAt =
    r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at);
  return {
    id: num(r.id),
    sectionId: num(r.section_id),
    roomId: num(r.room_id),
    isPrimary: r.is_primary,
    createdAt,
  };
}

function mirrorMapping(row: SectionRoomMapping) {
  const arr = memDb.sectionRoomMappings();
  const i = arr.findIndex((m) => m.id === row.id);
  if (i >= 0) arr[i] = row;
  else {
    const dup = arr.findIndex((m) => m.sectionId === row.sectionId && m.roomId === row.roomId);
    if (dup >= 0) arr[dup] = row;
    else arr.push(row);
  }
  _ensureNextIdAbove(row.id);
}

function timetableRoomFallback(sectionId: number): SectionRoomMappingView | null {
  const tt = memDb.timetable().find((t) => t.isActive && t.sectionId === sectionId);
  if (!tt) return null;
  return { sectionId, roomId: tt.roomId, isPrimary: true, mappingId: null, source: 'timetable' };
}

async function pgTimetableRoomFallback(sectionId: number): Promise<SectionRoomMappingView | null> {
  const r = await dbQuery<{ room_id: string | number }>(
    `SELECT room_id FROM school_timetable_entries
     WHERE section_id = $1 AND is_active = TRUE
     ORDER BY id LIMIT 1`,
    [sectionId],
  );
  const roomId = r?.rows[0]?.room_id;
  if (roomId == null) return null;
  return { sectionId, roomId: num(roomId), isPrimary: true, mappingId: null, source: 'timetable' };
}

export async function listSectionRoomMappings(sectionId: number): Promise<SectionRoomMapping[]> {
  if (!isDbEnabled()) {
    return memDb.sectionRoomMappings().filter((m) => m.sectionId === sectionId);
  }
  requirePool();
  const r = await dbQuery<MappingRow>(
    `SELECT id, section_id, room_id, is_primary, created_at
     FROM school_section_room_mappings
     WHERE section_id = $1
     ORDER BY is_primary DESC, id`,
    [sectionId],
  );
  const rows = (r?.rows ?? []).map(mappingFromRow);
  for (const row of rows) mirrorMapping(row);
  return rows;
}

export async function getSectionRoomMapping(sectionId: number): Promise<SectionRoomMappingView | null> {
  if (!isDbEnabled()) {
    const primary = memDb.sectionRoomMappings().find((m) => m.sectionId === sectionId && m.isPrimary);
    if (primary) {
      return { sectionId, roomId: primary.roomId, isPrimary: true, mappingId: primary.id };
    }
    const any = memDb.sectionRoomMappings().find((m) => m.sectionId === sectionId);
    if (any) {
      return { sectionId, roomId: any.roomId, isPrimary: any.isPrimary, mappingId: any.id };
    }
    return timetableRoomFallback(sectionId);
  }
  requirePool();
  const primary = await dbQuery<MappingRow>(
    `SELECT id, section_id, room_id, is_primary, created_at
     FROM school_section_room_mappings
     WHERE section_id = $1 AND is_primary = TRUE
     LIMIT 1`,
    [sectionId],
  );
  if (primary?.rows[0]) {
    const row = mappingFromRow(primary.rows[0]);
    mirrorMapping(row);
    return { sectionId, roomId: row.roomId, isPrimary: true, mappingId: row.id };
  }
  const any = await dbQuery<MappingRow>(
    `SELECT id, section_id, room_id, is_primary, created_at
     FROM school_section_room_mappings
     WHERE section_id = $1
     ORDER BY id LIMIT 1`,
    [sectionId],
  );
  if (any?.rows[0]) {
    const row = mappingFromRow(any.rows[0]);
    mirrorMapping(row);
    return { sectionId, roomId: row.roomId, isPrimary: row.isPrimary, mappingId: row.id };
  }
  return pgTimetableRoomFallback(sectionId);
}

export async function setSectionRoomMapping(
  sectionId: number,
  roomId: number,
  isPrimary = true,
): Promise<SectionRoomMapping> {
  if (!isDbEnabled()) {
    return setSectionRoomMappingMem(sectionId, roomId, isPrimary);
  }
  requirePool();

  const section = await dbQuery(`SELECT id FROM school_sections WHERE id = $1`, [sectionId]);
  if (!section?.rows[0]) throw new Error('Section not found');
  const room = await dbQuery(`SELECT id FROM school_rooms WHERE id = $1`, [roomId]);
  if (!room?.rows[0]) throw new Error('Room not found');

  let action: 'create' | 'update' = 'create';
  const row = await withDbTransaction(async (query) => {
    if (isPrimary) {
      await query(
        `UPDATE school_section_room_mappings SET is_primary = FALSE WHERE section_id = $1`,
        [sectionId],
      );
      const memMappings = memDb.sectionRoomMappings();
      for (const m of memMappings) {
        if (m.sectionId === sectionId) m.isPrimary = false;
      }
    }

    const existing = await query<MappingRow>(
      `SELECT id, section_id, room_id, is_primary, created_at
       FROM school_section_room_mappings
       WHERE section_id = $1 AND room_id = $2`,
      [sectionId, roomId],
    );
    if (existing?.rows[0]) {
      action = 'update';
      const updated = await query<MappingRow>(
        `UPDATE school_section_room_mappings SET is_primary = $1
         WHERE section_id = $2 AND room_id = $3
         RETURNING id, section_id, room_id, is_primary, created_at`,
        [isPrimary, sectionId, roomId],
      );
      if (!updated?.rows[0]) throw new Error('Failed to update section room mapping');
      return mappingFromRow(updated.rows[0]);
    }

    const inserted = await query<MappingRow>(
      `INSERT INTO school_section_room_mappings (section_id, room_id, is_primary)
       VALUES ($1, $2, $3)
       RETURNING id, section_id, room_id, is_primary, created_at`,
      [sectionId, roomId, isPrimary],
    );
    if (!inserted?.rows[0]) throw new Error('Failed to create section room mapping');
    return mappingFromRow(inserted.rows[0]);
  });

  mirrorMapping(row);
  logAudit(action, 'section_room_mapping', row.id, row);
  return row;
}

/** Alias: SELECT WHERE section_id = $1 LIMIT 1 (primary first, then any, then timetable fallback). */
export const getSectionRoomMappingDb = getSectionRoomMapping;

/** Alias: SELECT WHERE section_id = $1 — all mappings for the section. */
export const listSectionRoomMappingsDb = listSectionRoomMappings;

/** Alias: INSERT ... ON CONFLICT DO UPDATE for section-room mapping. */
export const setSectionRoomMappingDb = setSectionRoomMapping;

export async function deleteSectionRoomMappingDb(sectionId: number): Promise<void> {
  if (!isDbEnabled()) {
    const arr = memDb.sectionRoomMappings();
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i].sectionId === sectionId) arr.splice(i, 1);
    }
    return;
  }
  requirePool();
  await dbQuery(`DELETE FROM school_section_room_mappings WHERE section_id = $1`, [sectionId]);
  const arr = memDb.sectionRoomMappings();
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].sectionId === sectionId) arr.splice(i, 1);
  }
}

export async function listAllSectionRoomMappingsDb(organizationId: number): Promise<SectionRoomMapping[]> {
  if (!isDbEnabled()) {
    const classIds = memDb.sections()
      .filter((s) => memDb.classes().find((c) => c.id === s.classId && c.organizationId === organizationId))
      .map((s) => s.id);
    return memDb.sectionRoomMappings().filter((m) => classIds.includes(m.sectionId));
  }
  requirePool();
  const r = await dbQuery<MappingRow>(
    `SELECT m.id, m.section_id, m.room_id, m.is_primary, m.created_at
     FROM school_section_room_mappings m
     JOIN school_sections sec ON sec.id = m.section_id
     JOIN school_classes cls ON cls.id = sec.class_id
     WHERE cls.organization_id = $1
     ORDER BY m.id`,
    [organizationId],
  );
  const rows = (r?.rows ?? []).map(mappingFromRow);
  for (const row of rows) mirrorMapping(row);
  return rows;
}

export async function hydrateSectionRoomMappingsFromPg(): Promise<{ hydrated: number }> {
  if (!isDbEnabled()) return { hydrated: 0 };
  requirePool();
  const r = await dbQuery<MappingRow>(
    `SELECT id, section_id, room_id, is_primary, created_at
     FROM school_section_room_mappings ORDER BY id`,
  );
  const rows = (r?.rows ?? []).map(mappingFromRow);
  for (const row of rows) mirrorMapping(row);
  return { hydrated: rows.length };
}
