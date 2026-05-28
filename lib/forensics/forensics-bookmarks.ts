import type { AIEvent } from '@/lib/types';

export type ForensicsBookmarkSource = 'manual' | 'ai_event';

export type ForensicsBookmark = {
  id: string;
  createdAt: string;
  label: string;
  notes?: string;
  timestamp: string;
  siteId: string;
  siteName?: string;
  cameraId?: string;
  cameraName?: string;
  eventId?: string;
  eventType?: string;
  clipUrl?: string | null;
  snapshotUrl?: string | null;
  tags: string[];
  source: ForensicsBookmarkSource;
};

const STORAGE_PREFIX = 'orion-forensics-bookmarks';

function storageKey(siteId: string) {
  return `${STORAGE_PREFIX}:${siteId}`;
}

export function loadBookmarks(siteId: string): ForensicsBookmark[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(siteId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ForensicsBookmark[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBookmarks(siteId: string, bookmarks: ForensicsBookmark[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey(siteId), JSON.stringify(bookmarks));
}

export function bookmarkFromAiEvent(
  event: AIEvent,
  siteName: string,
  label?: string,
): Omit<ForensicsBookmark, 'id' | 'createdAt'> {
  return {
    label: label?.trim() || (event.summary ?? `${event.event_type} - ${event.camera_name ?? event.camera_id}`).slice(0, 120),
    notes: '',
    timestamp: event.start_ts,
    siteId: event.site_id,
    siteName,
    cameraId: event.camera_id,
    cameraName: event.camera_name ?? event.camera_id,
    eventId: event.event_id,
    eventType: event.event_type,
    clipUrl: event.clip_url,
    snapshotUrl: event.snapshot_url,
    tags: ['ai-event'],
    source: 'ai_event',
  };
}

export function createManualBookmark(input: {
  label: string;
  notes?: string;
  timestamp: string;
  siteId: string;
  siteName?: string;
  cameraId?: string;
  cameraName?: string;
  tags?: string[];
}): Omit<ForensicsBookmark, 'id' | 'createdAt'> {
  const tags = [...(input.tags ?? [])];
  if (!tags.includes('manual')) tags.push('manual');
  return {
    label: input.label.trim(),
    notes: input.notes?.trim() || undefined,
    timestamp: input.timestamp,
    siteId: input.siteId,
    siteName: input.siteName,
    cameraId: input.cameraId,
    cameraName: input.cameraName,
    tags,
    source: 'manual',
  };
}

export function parseTagsInput(raw: string): string[] {
  return raw
    .split(/[,;]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}
