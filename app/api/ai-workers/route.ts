import '@/lib/school-persistence/init';
import { json } from '@/lib/school-ai-signals/json';
import { listWorkers } from '@/lib/school-ai-signals/store';
export async function GET() { return json({ workers: listWorkers() }); }
