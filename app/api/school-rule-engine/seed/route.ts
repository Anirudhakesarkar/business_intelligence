import '@/lib/school-persistence/init';
import { json } from '@/lib/school-rule-engine/json';
import { seedRuleEngine } from '@/lib/school-rule-engine/seed';

export async function POST() {
  const result = seedRuleEngine(1);
  return json({ ok: true, ...result });
}
