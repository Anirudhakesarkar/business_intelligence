import type { AuthUserRole } from '@/lib/types';
import type { EventSeverity, EventType } from './types';

export type SchoolNotification = {
  id: number;
  organizationId: number;
  eventId: number;
  eventType: EventType;
  severity: EventSeverity;
  title: string;
  body: string;
  channel: 'in_app';
  createdAt: string;
  readAt?: string;
};

let nextId = 1;
const notifications: SchoolNotification[] = [];
const notifiedKeys = new Set<string>();

const NOTIFY_TYPES = new Set<EventType>(['CriticalCameraOffline', 'GateCongestion', 'FireSmokeDetected', 'ServerRoomEntry']);

/** Gate/process alerts require ops roles when RBAC is enforced. */
export const GATE_OPS_EVENT_TYPES = new Set<EventType>(['GateCongestion', 'DispersalDelay', 'ArrivalCongestion']);

const OPS_ROLES: AuthUserRole[] = ['superadmin', 'org_admin', 'site_admin', 'operator'];

export function canReceiveNotification(role: AuthUserRole | undefined, eventType: EventType, severity: EventSeverity) {
  if (!role || !process.env.SCHOOL_RBAC) return true;
  if (GATE_OPS_EVENT_TYPES.has(eventType) && !OPS_ROLES.includes(role)) return false;
  if (eventType === 'CriticalCameraOffline' && role === 'site_viewer') return false;
  if (severity === 'Critical' && role === 'site_viewer') return false;
  return true;
}

export function maybeNotifyEvent(
  organizationId: number,
  eventId: number,
  eventType: EventType,
  severity: EventSeverity,
  summary: string
) {
  if (!NOTIFY_TYPES.has(eventType) && severity !== 'Critical') return null;
  const key = `event:${eventId}`;
  if (notifiedKeys.has(key)) return null;
  notifiedKeys.add(key);
  const row: SchoolNotification = {
    id: nextId++,
    organizationId,
    eventId,
    eventType,
    severity,
    title: eventType.replace(/([A-Z])/g, ' $1').trim(),
    body: summary,
    channel: 'in_app',
    createdAt: new Date().toISOString(),
  };
  notifications.push(row);
  return row;
}

export function listNotifications(
  organizationId: number,
  unreadOnly = false,
  role?: AuthUserRole
) {
  return notifications
    .filter((n) => n.organizationId === organizationId && (!unreadOnly || !n.readAt))
    .filter((n) => canReceiveNotification(role, n.eventType, n.severity))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function markNotificationRead(id: number) {
  const n = notifications.find((x) => x.id === id);
  if (n) n.readAt = new Date().toISOString();
  return n;
}

export function resetNotifications() {
  notifications.length = 0;
  notifiedKeys.clear();
  nextId = 1;
}
