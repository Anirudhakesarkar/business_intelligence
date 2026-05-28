import '@/lib/school-persistence/init';
import { json } from '@/lib/school-ai-signals/json';
import { listHeartbeats, listWorkers } from '@/lib/school-ai-signals/store';

export async function GET() {
  const workers = listWorkers();
  return json({ workers, heartbeats: workers.flatMap((w) => listHeartbeats(w.id, 5)) });
}
