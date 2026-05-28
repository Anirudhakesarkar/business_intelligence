import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { authorizeSchoolRequest } from '../school-auth/rbac';
import { db, logAudit, patchCamera, setAuditActor } from './store';
import { seedDemoSchool } from './seed';

describe('school-foundation settings and audit', () => {
  it('audit log captures camera update with actor metadata', () => {
    seedDemoSchool(1);
    const cam = db.cameras().find((c) => c.organizationId === 1)!;
    setAuditActor(42);
    logAudit('update', 'camera', cam.id, { name: 'Updated cam' }, cam);
    const entry = db.auditLog().find((a) => a.entityType === 'camera' && a.entityId === cam.id && a.action === 'update');
    assert.ok(entry);
    assert.equal(entry!.actorId, 42);
    assert.ok(entry!.afterData);
    assert.ok(entry!.beforeData);
  });

  it('patchCamera writes audit within same request flow', () => {
    seedDemoSchool(1);
    const cam = db.cameras().find((c) => c.organizationId === 1)!;
    const beforeCount = db.auditLog().length;
    patchCamera(cam.id, { name: 'Camera audit test' });
    assert.ok(db.auditLog().length > beforeCount);
  });

  it('RBAC blocks site_viewer on write when enabled', async () => {
    const prev = process.env.SCHOOL_RBAC;
    process.env.SCHOOL_RBAC = '1';
    try {
      const denied = await authorizeSchoolRequest(
        new NextRequest('http://localhost/api/cameras', {
          method: 'POST',
          headers: { authorization: 'Bearer demo-e2e-token', 'x-school-role': 'site_viewer' },
        })
      );
      assert.equal(denied.ok, false);
      const allowed = await authorizeSchoolRequest(
        new NextRequest('http://localhost/api/cameras', {
          method: 'POST',
          headers: { authorization: 'Bearer demo-e2e-token', 'x-school-role': 'org_admin' },
        })
      );
      assert.equal(allowed.ok, true);
    } finally {
      if (prev === undefined) delete process.env.SCHOOL_RBAC;
      else process.env.SCHOOL_RBAC = prev;
    }
  });
});
