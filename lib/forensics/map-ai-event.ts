import type { AIEvent } from '@/lib/types';

export type SmartEventType =
  | 'person'
  | 'vehicle'
  | 'intrusion'
  | 'loitering'
  | 'tailgating'
  | 'ppe_violation'
  | 'crowd'
  | 'unknown';

export type PersonAttributes = {
  gender: 'male' | 'female' | 'unknown';
  ageBand: 'child' | 'teen' | 'adult' | 'senior' | 'unknown';
  topColor: 'black' | 'white' | 'red' | 'blue' | 'green' | 'yellow' | 'brown' | 'other' | 'unknown';
  bottomColor: 'black' | 'white' | 'red' | 'blue' | 'green' | 'yellow' | 'brown' | 'other' | 'unknown';
  hat: boolean;
  backpack: boolean;
  glasses: boolean;
  mask: boolean;
  uniform: boolean;
};

export type SmartSearchResult = {
  id: string;
  eventId: string;
  siteId: string;
  site: string;
  cameraId: string;
  camera: string;
  ts: string;
  eventType: SmartEventType;
  apiEventType: string;
  personLabel: string;
  attributes: PersonAttributes;
  confidence: number;
  tags: string[];
  summary: string;
  clipUrl?: string | null;
  snapshotUrl?: string | null;
  incidentId?: string | null;
};

const COLORS = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'brown'] as const;

export function mapApiEventType(eventType: string): SmartEventType {
  const t = String(eventType ?? '').toUpperCase();
  if (t.includes('INTRUSION') || t.includes('TAILGATE') || t.includes('RAIL_CLIMB') || t.includes('HAZARD_CLIMB')) {
    return 'intrusion';
  }
  if (t.includes('LOITER') || t.includes('GATHER')) return 'loitering';
  if (t.includes('CROWD')) return 'crowd';
  if (t.includes('PPE')) return 'ppe_violation';
  if (t.includes('VEHICLE')) return 'vehicle';
  if (t.includes('PERSON') || t === 'FALL') return 'person';
  return 'unknown';
}

export function parseAttributesFromText(text: string): PersonAttributes {
  const hay = text.toLowerCase();
  const attrs: PersonAttributes = {
    gender: hay.includes('female') ? 'female' : hay.includes('male') ? 'male' : 'unknown',
    ageBand: 'unknown',
    topColor: 'unknown',
    bottomColor: 'unknown',
    hat: /\bhat\b|\bcap\b/.test(hay),
    backpack: /\bbackpack\b|\bbag\b/.test(hay),
    glasses: /\bglasses\b|\bspectacles\b/.test(hay),
    mask: /\bmask\b/.test(hay),
    uniform: /\buniform\b/.test(hay),
  };
  for (const c of COLORS) {
    if (hay.includes(`${c} top`) || hay.includes(`${c} shirt`) || hay.includes(`${c} jacket`)) {
      attrs.topColor = c;
      break;
    }
  }
  return attrs;
}

function severityToConfidence(severity: string): number {
  const s = String(severity ?? '').toLowerCase();
  if (s === 'critical' || s === 'high') return 0.92;
  if (s === 'warning' || s === 'warn' || s === 'medium') return 0.78;
  return 0.62;
}

export function mapAiEventToSmartSearchResult(
  e: AIEvent,
  siteNameById: Map<string, string>,
): SmartSearchResult {
  const summary = (e.summary ?? '').trim() || `${e.event_type} on ${e.camera_name ?? e.camera_id}`;
  const attrs = parseAttributesFromText(summary);
  const confidence = severityToConfidence(e.severity);
  const eventType = mapApiEventType(e.event_type);
  const tags: string[] = [];
  if (confidence >= 0.85) tags.push('high-confidence');
  if (e.incident_id) tags.push('incident-linked');
  if (e.clip_url) tags.push('has-clip');

  const personLabel =
    eventType === 'person' || summary.toLowerCase().includes('person')
      ? `Person (${attrs.gender}, ${attrs.topColor} top)`
      : summary.length > 80
        ? `${summary.slice(0, 77)}…`
        : summary;

  return {
    id: e.event_id,
    eventId: e.event_id,
    siteId: e.site_id,
    site: siteNameById.get(e.site_id) ?? e.site_id,
    cameraId: e.camera_id,
    camera: e.camera_name ?? e.camera_id,
    ts: e.start_ts,
    eventType,
    apiEventType: e.event_type,
    personLabel,
    attributes: attrs,
    confidence,
    tags,
    summary,
    clipUrl: e.clip_url,
    snapshotUrl: e.snapshot_url,
    incidentId: e.incident_id,
  };
}
