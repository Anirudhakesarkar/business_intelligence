import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchoolMemory } from './seed';
import { countDemoTaggedForOrg, removeDemoTaggedForOrg, tagCurrentFoundationAsDemo } from './demo-tags';
import { db, resetStoreForSeed } from './store';

describe('school-foundation demo tags', () => {
  it('tags foundation after memory seed and cleanup removes tagged rows only', async () => {
    resetStoreForSeed();
    seedDemoSchoolMemory(1);
    await tagCurrentFoundationAsDemo(1);

    const before = await countDemoTaggedForOrg(1);
    assert.ok(before.total > 0);

    const preview = await removeDemoTaggedForOrg(1, { dryRun: true });
    assert.equal(preview.dryRun, true);
    assert.equal(preview.counts.total, before.total);

    const manualSite = db.sites().length;
    const result = await removeDemoTaggedForOrg(1, { dryRun: false });
    assert.equal(result.dryRun, false);
    assert.ok((result.deleted?.total ?? 0) > 0);

    const after = await countDemoTaggedForOrg(1);
    assert.equal(after.total, 0);
    assert.ok(db.cameras().filter((c) => c.organizationId === 1).length === 0);
  });
});
