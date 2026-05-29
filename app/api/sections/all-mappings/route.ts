import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json, err } from '@/lib/school-foundation/json';
import { db } from '@/lib/school-foundation/store';
import { listAllSectionRoomMappingsDb, DbDisabledError } from '@/lib/school-foundation/repos';
import { ensureFoundationHydrated } from '@/lib/school-db/hydrate';

/** GET /api/sections/all-mappings — returns every section-room mapping.
 *  Query param: organizationId (required for DB-backed path).
 */
export async function GET(req: NextRequest) {
  try {
    await ensureFoundationHydrated();
    const orgId = req.nextUrl.searchParams.get('organizationId');
    if (orgId) {
      const rows = await listAllSectionRoomMappingsDb(Number(orgId));
      return json(rows);
    }
    // Fallback: return in-memory store (no org filter)
    return json(db.sectionRoomMappings());
  } catch (e) {
    if (e instanceof DbDisabledError) return err(e.message, 503);
    return err((e as Error).message, 500);
  }
}
