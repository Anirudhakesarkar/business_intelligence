import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

const FORBIDDEN = [
  /\/api\/ai-signals\b/,
  /\/api\/school-ai-signals\/signals\b/,
  /useSchoolAiSignals/,
  /from ['"]@\/components\/school-management\/useSchoolAiSignals/,
];

describe('school-intelligence KPI source guard', () => {
  it('school-intelligence UI does not fetch raw ai_signals for KPIs', () => {
    const dir = join(ROOT, 'app/(dashboard)/dashboard/school-intelligence');
    const componentDir = join(ROOT, 'components/school-intelligence');
    const files = [...walk(dir), ...walk(componentDir)].filter(
      (f) => !f.includes('SIDailyTrendCard') && !f.endsWith('.test.ts')
    );
    const violations: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const re of FORBIDDEN) {
        if (re.test(src)) violations.push(`${file}: ${re}`);
      }
    }
    assert.deepEqual(violations, []);
  });
});
