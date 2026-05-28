import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  canReceiveNotification,
  listNotifications,
  maybeNotifyEvent,
  resetNotifications,
} from './notifications';

describe('school-rule-engine notifications', () => {
  beforeEach(() => {
    resetNotifications();
    delete process.env.SCHOOL_RBAC;
  });

  it('creates one notification per event id', () => {
    maybeNotifyEvent(1, 10, 'CriticalCameraOffline', 'Critical', 'Camera offline');
    maybeNotifyEvent(1, 10, 'CriticalCameraOffline', 'Critical', 'duplicate');
    assert.equal(listNotifications(1).length, 1);
  });

  it('blocks gate alerts for site_viewer when RBAC on', () => {
    process.env.SCHOOL_RBAC = '1';
    maybeNotifyEvent(1, 11, 'GateCongestion', 'High', 'Gate busy');
    assert.equal(listNotifications(1, false, 'site_viewer').length, 0);
    assert.equal(listNotifications(1, false, 'operator').length, 1);
    delete process.env.SCHOOL_RBAC;
  });

  it('allows critical offline for operator', () => {
    process.env.SCHOOL_RBAC = '1';
    maybeNotifyEvent(1, 12, 'CriticalCameraOffline', 'Critical', 'Offline');
    assert.equal(listNotifications(1, false, 'operator').length, 1);
    assert.equal(listNotifications(1, false, 'site_viewer').length, 0);
    delete process.env.SCHOOL_RBAC;
  });
});
