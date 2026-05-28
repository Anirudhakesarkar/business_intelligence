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
    else if (p.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

const FORBIDDEN = [
  /\boverall score\b/i,
  /\bmodule score\b/i,
  /\bGPT\b/,
  /\bprincipal summary\b/i,
  /\bmanagement recommendation\b/i,
  /\bParent Experience score\b/i,
  /\bTeacher Productivity score\b/i,
];

const SIGNAL_SURFACES = [
  join(ROOT, 'app/(dashboard)/dashboard/school-management/signals'),
  join(ROOT, 'app/(dashboard)/dashboard/school-management/workers'),
  join(ROOT, 'components/school-management'),
];

describe('phase2 signals UI guard', () => {
  it('signal/worker surfaces do not state management conclusions', () => {
    const files = SIGNAL_SURFACES.flatMap((d) => walk(d)).filter(
      (f) => !f.includes('ai-health') && !f.endsWith('.test.ts')
    );
    const violations: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      for (const re of FORBIDDEN) {
        for (const line of lines) {
          if (!re.test(line)) continue;
          if (/not management conclusions or GPT summaries/i.test(line)) continue;
          violations.push(`${file}: ${re}`);
          break;
        }
      }
    }
    assert.deepEqual(violations, []);
  });

  it('signals timeline page declares raw-evidence-only scope', () => {
    const page = join(ROOT, 'app/(dashboard)/dashboard/school-management/signals/page.tsx');
    const src = readFileSync(page, 'utf8');
    assert.match(src, /Raw AI evidence only/i);
    assert.match(src, /not management conclusions/i);
  });
});
