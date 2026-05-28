import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoSchool } from './seed';
import {
  countAcceptanceResidueRows,
  removeAcceptanceResidueRows,
  ACCEPTANCE_RESIDUE_CONFIRM_TOKEN,
} from './repos/acceptance-residue';
import { createCamera, db, resetStoreForSeed } from './store';

describe('acceptance-residue', () => {
  it('counts and removes accept-pattern cameras from memory store', async () => {
    resetStoreForSeed();
    await seedDemoSchool(1);
    createCamera({
      organizationId: 1,
      cameraCode: 'CAM-accept-test-1',
      name: 'Acceptance leftover',
      streamUrl: 'rtsp://test',
      purpose: 'Corridor',
      processOwner: 'Compliance',
      criticality: 'Medium',
      zoneId: db.zones()[0]?.id,
      status: 'Inactive',
    });

    const before = await countAcceptanceResidueRows(1);
    assert.ok(before.cameras >= 1);

    const result = await removeAcceptanceResidueRows({ organizationId: 1, dryRun: false });
    assert.equal(result.dryRun, false);
    assert.ok((result.deleted?.cameras ?? 0) >= 1);
    assert.ok(!db.cameras().some((c) => c.cameraCode === 'CAM-accept-test-1'));
  });

  it('exports confirm token constant', () => {
    assert.equal(ACCEPTANCE_RESIDUE_CONFIRM_TOKEN, 'REMOVE_ACCEPTANCE_RESIDUE');
  });
});
