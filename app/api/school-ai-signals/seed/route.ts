import '@/lib/school-persistence/init';
import { json } from '@/lib/school-ai-signals/json';
import { seedDemoAiSignals } from '@/lib/school-ai-signals/seed';

export async function POST() {
  const result = seedDemoAiSignals(1);
  return json({ ok: true, ...result });
}
