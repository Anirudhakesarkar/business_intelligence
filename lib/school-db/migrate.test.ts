import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runSchoolMigrations, SCHOOL_MIGRATION_FILES } from './migrate';

describe('school-db migrate', () => {
  it('lists school migration files', () => {
    assert.equal(SCHOOL_MIGRATION_FILES.length, 10);
    assert.ok(SCHOOL_MIGRATION_FILES.includes('071_school_score_engine.sql'));
    assert.ok(SCHOOL_MIGRATION_FILES.includes('073_school_runtime_snapshot.sql'));
    assert.ok(SCHOOL_MIGRATION_FILES.includes('074_school_campuses_align.sql'));
    assert.ok(SCHOOL_MIGRATION_FILES.includes('075_school_demo_entity_tags.sql'));
  });

  it('returns error when DATABASE_URL unset', async () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const r = await runSchoolMigrations();
    assert.equal(r.ok, false);
    if (prev) process.env.DATABASE_URL = prev;
  });
});
