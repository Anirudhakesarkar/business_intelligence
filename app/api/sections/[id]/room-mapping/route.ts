import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import {
  db,
  getSection,
  getSectionRoomMapping,
  listSectionRoomMappings,
  setSectionRoomMapping,
} from '@/lib/school-foundation/store';

/** GET /api/sections/:id/room-mapping */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const sectionId = Number(id);
    const section = getSection(sectionId);
    const mapping = getSectionRoomMapping(sectionId);
    const room = mapping ? db.rooms().find((r) => r.id === mapping.roomId) : null;
    return json({
      section,
      mapping,
      room,
      mappings: listSectionRoomMappings(sectionId),
    });
  } catch (e) {
    return err((e as Error).message, 404);
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
    const row = setSectionRoomMapping(sectionId, roomId, body.isPrimary !== false);
    const room = db.rooms().find((r) => r.id === row.roomId);
    return json({ mapping: row, room });
  } catch (e) {
    return err((e as Error).message);
  }
}
