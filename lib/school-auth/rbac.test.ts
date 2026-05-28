import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  authorizeSchoolRequest,
  isSchoolApiPath,
  requiredPermission,
  schoolRbacEnabled,
} from './rbac';

describe('school-auth rbac', () => {
  const prev = process.env.SCHOOL_RBAC;

  afterEach(() => {
    if (prev === undefined) delete process.env.SCHOOL_RBAC;
    else process.env.SCHOOL_RBAC = prev;
  });

  it('detects school API paths', () => {
    assert.equal(isSchoolApiPath('/api/school-management/setup-health'), true);
    assert.equal(isSchoolApiPath('/api/school-db/status'), false);
    assert.equal(isSchoolApiPath('/api/intelligence-events/1'), true);
    assert.equal(isSchoolApiPath('/api/auth/login'), false);
  });

  it('maps GET to read and POST to write', () => {
    assert.equal(requiredPermission('GET', '/api/cameras'), 'read');
    assert.equal(requiredPermission('POST', '/api/cameras'), 'write');
    assert.equal(requiredPermission('POST', '/api/school-intelligence/bootstrap'), 'admin');
  });

  it('allows all when RBAC disabled', async () => {
    delete process.env.SCHOOL_RBAC;
    const req = new NextRequest('http://localhost/api/cameras', { method: 'POST' });
    const r = await authorizeSchoolRequest(req);
    assert.equal(r.ok, true);
  });

  it('requires bearer when RBAC enabled', async () => {
    process.env.SCHOOL_RBAC = '1';
    const req = new NextRequest('http://localhost/api/cameras', { method: 'POST' });
    const r = await authorizeSchoolRequest(req);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 401);
  });

  it('accepts demo token for e2e when not production', async () => {
    process.env.SCHOOL_RBAC = '1';
    const req = new NextRequest('http://localhost/api/school-management/setup-health', {
      method: 'GET',
      headers: { authorization: 'Bearer demo-e2e-token' },
    });
    const r = await authorizeSchoolRequest(req);
    assert.equal(r.ok, true);
  });

  it('blocks site_viewer on write', async () => {
    process.env.SCHOOL_RBAC = '1';
    const req = new NextRequest('http://localhost/api/cameras', {
      method: 'POST',
      headers: {
        authorization: 'Bearer demo-e2e-token',
        'x-school-role': 'site_viewer',
      },
    });
    const r = await authorizeSchoolRequest(req);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 403);
  });

  it('blocks site_viewer on PATCH intelligence-rules (threshold save)', async () => {
    process.env.SCHOOL_RBAC = '1';
    const req = new NextRequest('http://localhost/api/intelligence-rules/1', {
      method: 'PATCH',
      headers: {
        authorization: 'Bearer demo-e2e-token',
        'x-school-role': 'site_viewer',
      },
    });
    const r = await authorizeSchoolRequest(req);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 403);
  });
});
