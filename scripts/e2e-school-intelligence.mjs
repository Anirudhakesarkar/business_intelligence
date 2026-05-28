#!/usr/bin/env node
/** E2E acceptance: Phases 1-6 in-memory pipeline (task 10). */
const BASE = process.env.BASE_URL || 'http://localhost:3001';
const ORG = process.env.ORG_ID || '1';

const AUTH_HEADERS = { authorization: 'Bearer demo-e2e-token' };

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { ...AUTH_HEADERS, ...(opts.headers || {}) } });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0, 200)}`);
  return json;
}

async function main() {
  console.log('School Intelligence E2E —', BASE);
  const status = await req('/api/school-db/status');
  console.log('  status:', status.postgres?.configured ? 'postgres configured' : 'memory', '| openai:', status.openai?.configured);

  const boot = await req(`/api/school-intelligence/bootstrap?organizationId=${ORG}`, { method: 'POST' });
  console.log('  bootstrap: ok', boot.snapshot?.saved !== false);

  const overview = await req(`/api/daily-summaries/overview?organizationId=${ORG}`);
  console.log('  daily modules:', overview.modules?.length ?? 0);

  const overall = await req(`/api/school-scores/overall?organizationId=${ORG}`);
  console.log('  overall score:', overall.overallScore ?? '—');

  const gpt = await req(`/api/gpt/daily-summary?organizationId=${ORG}`);
  console.log('  gpt summary:', gpt.summary ? 'yes' : 'no');

  const recs = await req(`/api/gpt/recommendations?organizationId=${ORG}`);
  console.log('  recommendations:', recs.recommendations?.length ?? 0);

  const audit = await req('/api/school-management/audit-log?limit=5');
  console.log('  audit entries:', audit.entries?.length ?? 0);
  const drill = await req('/api/school-scores/modules/teacher/drilldown?organizationId=1');
  console.log('  drilldown events:', drill.eventCount ?? 0);
  const ask = await req('/api/gpt/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ organizationId: Number(ORG), question: 'Why is parent experience low today?' }),
  });
  console.log('  ask:', ask.answer ? 'yes' : 'no', '| model:', ask.model ?? 'demo');

  console.log('\nE2E PASSED');
}

main().catch((e) => {
  console.error('E2E FAILED:', e.message);
  process.exit(1);
});
