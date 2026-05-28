import type { AIEvent } from '@/lib/types';
import type { AuditLogEntry } from './use-forensics-api';

export type LockerItemType = 'clip' | 'snapshot' | 'report';

export type LockerItem = {
  id: string;
  type: LockerItemType;
  label: string;
  storedAt: string;
  hash: string;
  watermarkStatus: 'applied' | 'pending' | 'none' | 'failed';
  integrityStatus: 'verified' | 'failed' | 'pending' | 'expired';
  retentionDays: number;
  expiresAt: string;
  caseIds: string[];
  caseLabels: string[];
  sizeBytes: number;
  camera?: string;
  site?: string;
  mediaUrl?: string;
};

export function aiEventsToLockerItems(
  events: AIEvent[],
  siteNameById: Map<string, string>,
): LockerItem[] {
  const items: LockerItem[] = [];
  const retentionDays = 90;
  for (const e of events) {
    const site = siteNameById.get(e.site_id) ?? e.site_id;
    const camera = e.camera_name ?? e.camera_id;
    const base = {
      retentionDays,
      expiresAt: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString(),
      caseIds: e.incident_id ? [e.incident_id] : [],
      caseLabels: e.incident_id ? [`Incident ${e.incident_id.slice(0, 8)}`] : [],
      sizeBytes: 0,
      camera,
      site,
      hash: '-',
      watermarkStatus: 'none' as const,
      integrityStatus: 'pending' as const,
    };
    if (e.clip_url) {
      items.push({
        ...base,
        id: `${e.event_id}-clip`,
        type: 'clip',
        label: (e.summary ?? `${e.event_type} clip`).slice(0, 120),
        storedAt: e.start_ts,
        mediaUrl: e.clip_url,
      });
    }
    if (e.snapshot_url) {
      items.push({
        ...base,
        id: `${e.event_id}-snap`,
        type: 'snapshot',
        label: (e.summary ?? `${e.event_type} snapshot`).slice(0, 120),
        storedAt: e.start_ts,
        mediaUrl: e.snapshot_url,
      });
    }
  }
  return items.sort((a, b) => new Date(b.storedAt).getTime() - new Date(a.storedAt).getTime());
}

export type CustodyEventType = 'viewed' | 'exported' | 'downloaded' | 'hash_verified';

export type CustodyEvent = {
  id: string;
  type: CustodyEventType;
  timestamp: string;
  userId: string;
  userName: string;
  targetId: string;
  targetLabel: string;
  targetType?: 'clip' | 'snapshot' | 'report' | 'case';
  hash?: string;
  hashMatch?: boolean;
  details?: string;
};

function mapAuditActionToCustodyType(action: string): CustodyEventType {
  const a = action.toLowerCase();
  if (a.includes('download')) return 'downloaded';
  if (a.includes('export')) return 'exported';
  if (a.includes('hash') || a.includes('verify') || a.includes('integrity')) return 'hash_verified';
  return 'viewed';
}

export function auditLogsToCustodyEvents(entries: AuditLogEntry[]): CustodyEvent[] {
  return entries.map((e) => ({
    id: e.id,
    type: mapAuditActionToCustodyType(e.action),
    timestamp: e.timestamp,
    userId: e.userId,
    userName: e.userName || e.userEmail || 'Unknown',
    targetId: e.resourceId ?? e.id,
    targetLabel: e.details ?? `${e.resource}${e.resourceId ? ` - ${e.resourceId}` : ''}`,
    details: e.details,
    hashMatch: e.success,
  }));
}
