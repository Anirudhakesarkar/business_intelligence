import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import { db, getSection } from '@/lib/school-foundation/store';
import {
  DbDisabledError,
  getSectionById,
  getSectionRoomMapping,
  listSectionRoomMappings,
  setSectionRoomMapping,
  deleteSectionRoomMappingDb,
} from '@/lib/school-foundation/repos';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';
import { isDbEnabled } from '@/lib/school-db/pool';

/** GET /api/sections/:id/room-mapping */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const sectionId = Number(id);
    await ensureFoundationHydrated();
    const section = isDbEnabled() ? await getSectionById(sectionId) : getSection(sectionId);
    const mapping = await getSectionRoomMapping(sectionId);
    const room = mapping ? db.rooms().find((r) => r.id === mapping.roomId) : null;
    return json({
      section,
      mapping,
      room,
      mappings: await listSectionRoomMappings(sectionId),
    });
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message, 404);
  }
}

/** DELETE /api/sections/:id/room-mapping — removes all mappings for the section. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const sectionId = Number(id);
    await deleteSectionRoomMappingDb(sectionId);
    return json({ ok: true, sectionId });
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message);
  }
}

/** PUT /api/sections/:id/room-mapping */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const sectionId = Number(id);
    const body = await req.json().catch(() => ({}));
    const roomId = Number(body.roomId);
    if (!roomId) return err('roomId required');
    const row = await setSectionRoomMapping(sectionId, roomId, body.isPrimary !== false);
    const room = db.rooms().find((r) => r.id === row.roomId);
    return json({ mapping: row, room });
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message);
  }
}
