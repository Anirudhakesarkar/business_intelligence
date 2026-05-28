import '@/lib/school-persistence/init';
import { json } from '@/lib/school-foundation/json';
import { db } from '@/lib/school-foundation/store';

/** GET /api/sections/all-mappings — returns every section-room mapping in the store. */
export async function GET() {
  return json(db.sectionRoomMappings());
}
