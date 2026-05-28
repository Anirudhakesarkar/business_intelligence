import '@/lib/school-persistence/init';
import { json } from '@/lib/school-foundation/json';
import { seedDemoSchool } from '@/lib/school-foundation/seed';
import { setAuditActor } from '@/lib/school-foundation/store';
import { parseActorId } from '@/lib/school-auth/rbac';

function actorFrom(req: import('next/server').NextRequest) {
  try {
    const p = JSON.parse(req.headers.get('x-school-principal') ?? 'null');
    return parseActorId(p);
  } catch { return undefined; }
}

export async function POST() {
  try {
    const result = await seedDemoSchool(1);
    return json({ ok: true, ...result });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
}
