import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchool } from './seed';
import { createZone, db, getSetupHealth, resetStoreForSeed } from './store';
import { countOrphanSpatialRows, removeOrphanSpatialRows } from './repos/orphan-spatial';

describe('orphan spatial cleanup', () => {
  it('counts orphan zones outside campus hierarchy', async () => {
    resetStoreForSeed();
    await seedDemoSchool(1);
    const before = await countOrphanSpatialRows();
    createZone({ name: 'Orphan Risk', zoneType: 'playground', isRiskZone: true, riskCategory: 'Playground' });
    const after = await countOrphanSpatialRows();
    assert.ok(after.orphanZones >= before.orphanZones + 1);
    const health = getSetupHealth(1);
    const riskMsgs = health.missing.filter((m) => m.includes('risk zone'));
    const beforeRisk = before.orphanZones > 0;
    if (!beforeRisk) {
      assert.equal(riskMsgs.length, 0);
    }
  });

  it('dry-run remove does not delete rows', async () => {
    resetStoreForSeed();
    await seedDemoSchool(1);
    createZone({ name: 'Orphan Only', zoneType: 'General', isRiskZone: false });
    const zoneCountBefore = db.zones().length;
    const result = await removeOrphanSpatialRows({ dryRun: true });
    assert.equal(result.dryRun, true);
    assert.equal(db.zones().length, zoneCountBefore);
  });
});
