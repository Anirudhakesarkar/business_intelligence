import '@/lib/school-persistence/init';
import { json } from '@/lib/school-ai-signals/json';
import { getWorkersHealthSummary } from '@/lib/school-ai-signals/store';
export async function GET() { return json(getWorkersHealthSummary()); }
