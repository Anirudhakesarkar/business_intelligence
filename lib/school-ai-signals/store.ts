import { db } from '../school-foundation/store';
import type { SchoolCamera } from '../school-foundation/types';
import { defaultEnabledSignals, defaultSampleRate } from './defaults';
import type {
  AiSignal, AiWorker, CameraFreshness, HealthEvent, HealthStatus, IngestSignalInput,
  ProcessingConfig, RetentionPolicy, SignalBatch, SignalType, WorkerStatus,
} from './types';

let nextId = 1;
const nid = () => nextId++;

const workers: AiWorker[] = [];
type Heartbeat = { id: number; workerId: number; observedAt: string; metrics: Record<string, unknown> };
const heartbeats: Heartbeat[] = [];
const batches: SignalBatch[] = [];
const signals: AiSignal[] = [];
const healthEvents: HealthEvent[] = [];
const processingConfigs = new Map<number, ProcessingConfig>();
const retentionPolicies = new Map<number, RetentionPolicy>();

const now = () => new Date().toISOString();
const STALE_MS = 10 * 60 * 1000;

function orgCameras(organizationId: number): SchoolCamera[] {
  return db.cameras().filter((c) => c.organizationId === organizationId && c.status === 'Active');
}

function cameraById(cameraId: number) {
  return db.cameras().find((c) => c.id === cameraId);
}

export function resetAiSignalsStore() {
  workers.length = 0;
  heartbeats.length = 0;
  batches.length = 0;
  signals.length = 0;
  healthEvents.length = 0;
  processingConfigs.clear();
  retentionPolicies.clear();
  diagnosticMedia.length = 0;
  nextId = 1;
}

export function ensureRetentionPolicy(organizationId: number): RetentionPolicy {
  let row = retentionPolicies.get(organizationId);
  if (!row) {
    row = { organizationId, signalsDays: 90, batchesDays: 90, healthDays: 365, heartbeatsDays: 30, snapshotDays: 14, clipDays: 7 };
    retentionPolicies.set(organizationId, row);
  }
  return row;
}

export function getProcessingConfig(cameraId: number): ProcessingConfig | undefined {
  return processingConfigs.get(cameraId);
}

export function upsertProcessingConfig(cameraId: number, patch: Partial<ProcessingConfig>): ProcessingConfig {
  const cam = cameraById(cameraId);
  if (!cam) throw new Error('Camera not found');
  const existing = processingConfigs.get(cameraId);
  const base: ProcessingConfig = existing ?? {
    cameraId,
    sampleRate: defaultSampleRate(cam.purpose),
    minConfidence: 0.5,
    enabledSignals: defaultEnabledSignals(cam.purpose),
    zonePolygons: {},
    snapshotEnabled: false,
    activeProcessing: true,
    updatedAt: now(),
  };
  const merged = { ...base, ...patch, cameraId, updatedAt: now() };
  processingConfigs.set(cameraId, merged);
  return merged;
}

export function ensureProcessingConfigsForOrg(organizationId: number) {
  for (const cam of orgCameras(organizationId)) {
    if (!processingConfigs.has(cam.id)) upsertProcessingConfig(cam.id, {});
  }
}

export function registerWorker(input: {
  workerKey: string; workerType: string; version?: string; capabilities?: string[];
}): AiWorker {
  const existing = workers.find((w) => w.workerKey === input.workerKey);
  if (existing) {
    existing.version = input.version ?? existing.version;
    existing.capabilities = input.capabilities ?? existing.capabilities;
    existing.status = 'Healthy';
    existing.lastHeartbeatAt = now();
    return existing;
  }
  const row: AiWorker = {
    id: nid(),
    workerKey: input.workerKey,
    workerType: input.workerType,
    version: input.version ?? '1.0.0',
    status: 'Healthy',
    capabilities: input.capabilities ?? [],
    registeredAt: now(),
    lastHeartbeatAt: now(),
  };
  workers.push(row);
  return row;
}

export function recordHeartbeat(workerId: number, metrics: Record<string, unknown> = {}) {
  const w = workers.find((x) => x.id === workerId);
  if (!w) throw new Error('Worker not found');
  const observedAt = now();
  heartbeats.push({ id: nid(), workerId, observedAt, metrics });
  w.lastHeartbeatAt = observedAt;
  w.status = 'Healthy';
  return heartbeats[heartbeats.length - 1];
}

export function listWorkers() {
  return [...workers].sort((a, b) => (b.lastHeartbeatAt ?? b.registeredAt).localeCompare(a.lastHeartbeatAt ?? a.registeredAt));
}

export function listHeartbeats(workerId?: number, limit = 50) {
  let rows = [...heartbeats];
  if (workerId) rows = rows.filter((h) => h.workerId === workerId);
  return rows.sort((a, b) => b.observedAt.localeCompare(a.observedAt)).slice(0, limit);
}

export function openBatch(input: {
  batchKey: string; cameraId: number; workerId?: number; modelVersion?: string;
}): SignalBatch {
  const cam = cameraById(input.cameraId);
  if (!cam || cam.status !== 'Active') throw new Error('Camera inactive or not found');
  const row: SignalBatch = {
    id: nid(),
    batchKey: input.batchKey,
    cameraId: input.cameraId,
    workerId: input.workerId,
    modelVersion: input.modelVersion ?? 'v1',
    frameCount: 0,
    startedAt: now(),
  };
  batches.push(row);
  return row;
}

export function closeBatch(batchId: number, frameCount?: number) {
  const b = batches.find((x) => x.id === batchId);
  if (!b) throw new Error('Batch not found');
  b.endedAt = now();
  if (frameCount != null) b.frameCount = frameCount;
  return b;
}

function isDuplicateSignal(input: IngestSignalInput) {
  const windowMs = 2000;
  const t = new Date(input.observedAt).getTime();
  return signals.some(
    (s) => s.cameraId === input.cameraId && s.signalType === input.signalType &&
      Math.abs(new Date(s.observedAt).getTime() - t) < windowMs
  );
}

export function ingestSignal(input: IngestSignalInput): { stored: boolean; reason?: string; signal?: AiSignal } {
  const cam = cameraById(input.cameraId);
  if (!cam) return { stored: false, reason: 'camera_not_found' };
  if (cam.status !== 'Active') return { stored: false, reason: 'camera_inactive' };
  const futureLimit = Date.now() + 24 * 60 * 60 * 1000;
  if (new Date(input.observedAt).getTime() > futureLimit) return { stored: false, reason: 'future_timestamp' };
  const cfg = processingConfigs.get(input.cameraId) ?? upsertProcessingConfig(input.cameraId, {});
  if (!cfg.activeProcessing) return { stored: false, reason: 'processing_disabled' };
  if (cfg.enabledSignals.length && !cfg.enabledSignals.includes(input.signalType)) {
    return { stored: false, reason: 'signal_type_disabled' };
  }
  const conf = input.confidence ?? 1;
  if (conf < cfg.minConfidence) return { stored: false, reason: 'below_min_confidence' };
  if (isDuplicateSignal(input)) return { stored: false, reason: 'duplicate' };
  const meta = input.metadata ?? {};
  for (const k of ['face_embedding', 'student_name', 'student_id', 'identity']) {
    if (k in meta) return { stored: false, reason: 'pii_metadata_forbidden' };
  }
  const row: AiSignal = {
    id: nid(),
    cameraId: input.cameraId,
    batchId: input.batchId,
    signalType: input.signalType,
    signalValue: input.signalValue,
    confidence: conf,
    observedAt: input.observedAt,
    metadata: input.metadata ?? {},
  };
  signals.push(row);
  if (input.signalType === 'Offline') {
    recordHealthEvent(input.cameraId, 'Offline', input.observedAt, { source: 'signal' });
  }
  if (input.signalType === 'Tamper') {
    recordHealthEvent(input.cameraId, 'Tampered', input.observedAt, { source: 'signal', tamper: true });
  }
  return { stored: true, signal: row };
}

export function ingestSignalsBulk(items: IngestSignalInput[]) {
  const results = items.map((item) => ({ ...ingestSignal(item), input: item }));
  const stored = results.filter((r) => r.stored).length;
  return { stored, failed: results.length - stored, results };
}

export function recordHealthEvent(
  cameraId: number,
  healthStatus: HealthStatus,
  startedAt?: string,
  metadata: Record<string, unknown> = {}
) {
  const open = healthEvents.find((e) => e.cameraId === cameraId && !e.endedAt && e.healthStatus === healthStatus);
  if (open) return open;
  const row: HealthEvent = { id: nid(), cameraId, healthStatus, startedAt: startedAt ?? now(), metadata };
  healthEvents.push(row);
  return row;
}

export function listHealthEvents(cameraId?: number, limit = 100) {
  let rows = [...healthEvents];
  if (cameraId) rows = rows.filter((e) => e.cameraId === cameraId);
  return rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit);
}

export type SignalQuery = {
  organizationId?: number;
  cameraId?: number;
  signalType?: SignalType;
  from?: string;
  to?: string;
  minConfidence?: number;
  limit?: number;
};

function signalsForOrg(organizationId: number) {
  const camIds = new Set(orgCameras(organizationId).map((c) => c.id));
  return signals.filter((s) => camIds.has(s.cameraId));
}

export function listSignals(query: SignalQuery = {}) {
  if (query.cameraId != null && query.organizationId != null) {
    const cam = cameraById(query.cameraId);
    if (!cam || cam.organizationId !== query.organizationId) return [];
  }
  let rows = query.organizationId != null ? signalsForOrg(query.organizationId) : [...signals];
  if (query.cameraId) rows = rows.filter((s) => s.cameraId === query.cameraId);
  if (query.signalType) rows = rows.filter((s) => s.signalType === query.signalType);
  if (query.from) rows = rows.filter((s) => s.observedAt >= query.from!);
  if (query.to) rows = rows.filter((s) => s.observedAt <= query.to!);
  if (query.minConfidence != null) rows = rows.filter((s) => (s.confidence ?? 1) >= query.minConfidence!);
  rows = rows.sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  const limit = query.limit ?? 500;
  return rows.slice(0, limit);
}

const TIMELINE_EXPORT_MAX = 5000;

export function getSignalTimeline(cameraId: number, from: string, to: string, limit = 2000) {
  const cap = Math.min(limit, TIMELINE_EXPORT_MAX);
  return signals
    .filter((s) => s.cameraId === cameraId && s.observedAt >= from && s.observedAt <= to)
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
    .slice(0, limit);
}

export function getLatestSignals(cameraId: number, types?: SignalType[]) {
  const cfg = processingConfigs.get(cameraId);
  const enabled = types ?? cfg?.enabledSignals ?? [];
  const out: Partial<Record<SignalType, AiSignal | null>> = {};
  for (const t of enabled) {
    const latest = signals
      .filter((s) => s.cameraId === cameraId && s.signalType === t)
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
    out[t] = latest ?? null;
  }
  return out;
}

export function getCameraFreshness(cameraId: number): CameraFreshness {
  const cfg = processingConfigs.get(cameraId) ?? upsertProcessingConfig(cameraId, {});
  const missingTypes: SignalType[] = [];
  let lastSignalAt: string | undefined;
  const tnow = Date.now();
  for (const t of cfg.enabledSignals) {
    const latest = signals.filter((s) => s.cameraId === cameraId && s.signalType === t)
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
    if (!latest) missingTypes.push(t);
    else if (!lastSignalAt || latest.observedAt > lastSignalAt) lastSignalAt = latest.observedAt;
  }
  const stale = !lastSignalAt || tnow - new Date(lastSignalAt).getTime() > STALE_MS;
  return { cameraId, lastSignalAt, stale, missingTypes };
}

export function reportStreamTimeout(cameraId: number, observedAt?: string) {
  return recordHealthEvent(cameraId, 'Offline', observedAt, { source: 'stream_timeout' });
}

export function runFreshnessHealthJob(organizationId: number) {
  ensureProcessingConfigsForOrg(organizationId);
  const staleCameras: number[] = [];
  const offlineEvents: number[] = [];
  for (const cam of orgCameras(organizationId)) {
    const fresh = getCameraFreshness(cam.id);
    if (fresh.stale) {
      staleCameras.push(cam.id);
      const ev = recordHealthEvent(cam.id, 'Offline', undefined, { source: 'freshness_s6', stale: true });
      offlineEvents.push(ev.id);
    }
  }
  return { organizationId, staleCameras, offlineEventsCreated: offlineEvents.length, checkedAt: now() };
}

export type CameraHealthRow = {
  camera: SchoolCamera;
  freshness: CameraFreshness;
  config: ProcessingConfig;
  latestHealth?: HealthEvent;
  signalCount24h: number;
};


export function resolveCameraHealthStatus(row: CameraHealthRow): HealthStatus {
  const ev = row.latestHealth?.healthStatus;
  if (ev === 'Tampered') return 'Tampered';
  if (ev === 'Unstable') return 'Unstable';
  if (ev === 'Maintenance') return 'Maintenance';
  if (row.freshness.stale || ev === 'Offline') return 'Offline';
  return 'Online';
}

export function getCameraHealthKpis(organizationId: number) {
  const grid = getCameraHealthGrid(organizationId);
  const workerSummary = getWorkersHealthSummary();
  let online = 0;
  let staleCount = 0;
  let criticalOffline = 0;
  let tampered = 0;
  for (const row of grid) {
    const status = resolveCameraHealthStatus(row);
    if (status === 'Online') online++;
    if (row.freshness.stale) staleCount++;
    if (status === 'Tampered') tampered++;
    if (
      (row.camera.criticality === 'Critical' || row.camera.criticality === 'High') &&
      status !== 'Online'
    ) {
      criticalOffline++;
    }
  }
  const totalActive = grid.length;
  return {
    totalActive,
    online,
    onlinePercent: totalActive ? Math.round((online / totalActive) * 100) : 0,
    staleCount,
    criticalOffline,
    tampered,
    workersHealthy: workerSummary.healthy,
    workersStale: workerSummary.stale,
    workersUnhealthy: workerSummary.unhealthy,
  };
}

export function getCameraHealthGrid(organizationId: number): CameraHealthRow[] {
  ensureProcessingConfigsForOrg(organizationId);
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return orgCameras(organizationId).map((camera) => {
    const freshness = getCameraFreshness(camera.id);
    const config = processingConfigs.get(camera.id)!;
    const latestHealth = listHealthEvents(camera.id, 1)[0];
    const signalCount24h = signals.filter((s) => s.cameraId === camera.id && s.observedAt >= from).length;
    return { camera, freshness, config, latestHealth, signalCount24h };
  });
}

export function getCameraAiDetail(cameraId: number) {
  const camera = cameraById(cameraId);
  if (!camera) throw new Error('Camera not found');
  const config = processingConfigs.get(cameraId) ?? upsertProcessingConfig(cameraId, {});
  const freshness = getCameraFreshness(cameraId);
  const latest = getLatestSignals(cameraId);
  const recentSignals = listSignals({ cameraId, limit: 100 });
  const recentBatches = batches.filter((b) => b.cameraId === cameraId).slice(-20);
  const health = listHealthEvents(cameraId, 20);
  return { camera, config, freshness, latest, recentSignals, recentBatches, health };
}

export function querySignalsForEvaluation(organizationId: number, from: string, to: string) {
  return signalsForOrg(organizationId).filter((s) => s.observedAt >= from && s.observedAt <= to);
}

export const aiDb = {
  workers: () => workers,
  heartbeats: () => heartbeats,
  batches: () => batches,
  signals: () => signals,
  healthEvents: () => healthEvents,
  configs: () => [...processingConfigs.values()],
};

export type DiagnosticMedia = {
  id: number;
  cameraId: number;
  mediaType: 'snapshot' | 'clip';
  storageUrl: string;
  capturedAt: string;
  expiresAt: string;
};

const diagnosticMedia: DiagnosticMedia[] = [];

export function registerDiagnosticMedia(input: Omit<DiagnosticMedia, 'id'>) {
  const cfg = getProcessingConfig(input.cameraId);
  if (cfg && !cfg.snapshotEnabled) throw new Error('Snapshot disabled for camera');
  const row: DiagnosticMedia = { ...input, id: nid() };
  diagnosticMedia.push(row);
  return row;
}

export function listDiagnosticMedia(cameraId: number, includeExpired = false) {
  const nowMs = Date.now();
  return diagnosticMedia.filter((m) => {
    if (m.cameraId !== cameraId) return false;
    if (includeExpired) return true;
    return new Date(m.expiresAt).getTime() > nowMs;
  });
}

export function deleteDiagnosticMedia(id: number) {
  const i = diagnosticMedia.findIndex((m) => m.id === id);
  if (i < 0) throw new Error('Not found');
  diagnosticMedia.splice(i, 1);
}

export function runRetentionJob(organizationId: number) {
  const policy = ensureRetentionPolicy(organizationId);
  const nowMs = Date.now();
  const signalCutoff = nowMs - policy.signalsDays * 86400000;
  let removedSignals = 0;
  for (let i = signals.length - 1; i >= 0; i--) {
    if (new Date(signals[i].observedAt).getTime() < signalCutoff) {
      signals.splice(i, 1);
      removedSignals++;
    }
  }
  let removedMedia = 0;
  for (let i = diagnosticMedia.length - 1; i >= 0; i--) {
    if (new Date(diagnosticMedia[i].expiresAt).getTime() < nowMs) {
      diagnosticMedia.splice(i, 1);
      removedMedia++;
    }
  }
  return { removedSignals, removedMedia, policy };
}

export type CameraHealthDaily = {
  organizationId: number;
  date: string;
  score: number;
  criticalCamerasTotal: number;
  criticalCamerasHealthy: number;
  offlineMinutes: number;
  tamperCount: number;
  cameras: { cameraId: number; cameraCode: string; offlineMinutes: number; health: HealthStatus }[];
};

/** Daily camera health: score = clamp(100 - offlineMinutes*0.8 - tamperCount*15). */
export function getCameraHealthDailyScore(organizationId: number, date: string): CameraHealthDaily {
  const cams = orgCameras(organizationId).filter((c) => c.criticality === 'Critical' || c.criticality === 'High');
  const from = `${date}T00:00:00.000Z`;
  const to = `${date}T23:59:59.999Z`;
  let offlineMinutes = 0;
  let tamperCount = 0;
  const perCam: CameraHealthDaily['cameras'] = [];
  let healthy = 0;
  for (const cam of cams) {
    const events = listHealthEvents(cam.id, 200).filter((e) => e.startedAt >= from && e.startedAt <= to);
    const offline = events.filter((e) => e.healthStatus === 'Offline' || e.healthStatus === 'Unstable');
    const tamper = events.filter((e) => e.healthStatus === 'Tampered').length;
    tamperCount += tamper;
    const mins = offline.length * 12;
    offlineMinutes += mins;
    const fresh = getCameraFreshness(cam.id);
    const ok = !fresh.stale && offline.length === 0;
    if (ok) healthy++;
    perCam.push({ cameraId: cam.id, cameraCode: cam.cameraCode, offlineMinutes: mins, health: fresh.stale ? 'Offline' : 'Online' });
  }
  const score = Math.max(0, Math.min(100, Math.round(100 - offlineMinutes * 0.8 - tamperCount * 15)));
  return {
    organizationId,
    date,
    score,
    criticalCamerasTotal: cams.length,
    criticalCamerasHealthy: healthy,
    offlineMinutes,
    tamperCount,
    cameras: perCam,
  };
}

export type DerivedSignal = {
  signalType: string;
  signalValue: number | string | boolean;
  confidence: number;
  observedAt: string;
  source: 'derived';
};

export function listDerivedSignals(cameraId: number, limit = 50): DerivedSignal[] {
  const recent = signals
    .filter((s) => s.cameraId === cameraId)
    .slice(-limit);
  const board = recent.filter((s) => s.signalType === 'TeacherNearBoard');
  const desks = recent.filter((s) => s.signalType === 'PersonCount');
  const out: DerivedSignal[] = [];
  if (board.length) {
    const last = board[board.length - 1];
    out.push({
      signalType: 'TeacherAtBoard',
      signalValue: Number(last.signalValue) > 0,
      confidence: last.confidence ?? 0.85,
      observedAt: last.observedAt,
      source: 'derived',
    });
  }
  if (desks.length) {
    const avg = desks.reduce((a, s) => a + Number(s.signalValue), 0) / desks.length;
    out.push({
      signalType: 'ClassroomEngagementIndex',
      signalValue: Math.round(avg * 10) / 10,
      confidence: 0.85,
      observedAt: desks[desks.length - 1].observedAt,
      source: 'derived',
    });
  }
  return out;
}


const WORKER_STALE_MS = 5 * 60 * 1000;

export function getWorkersHealthSummary() {
  const now = Date.now();
  const summary = listWorkers().map((w) => {
    const last = w.lastHeartbeatAt ? new Date(w.lastHeartbeatAt).getTime() : 0;
    const stale = !last || now - last > WORKER_STALE_MS;
    return { ...w, status: stale ? 'Stale' : w.status, stale };
  });
  return {
    healthy: summary.filter((w) => w.status === 'Healthy').length,
    unhealthy: summary.filter((w) => w.status === 'Unhealthy').length,
    stale: summary.filter((w) => w.stale).length,
    workers: summary,
  };
}
// --- API compatibility (camera-health* routes)
export function createHealthEvent(input: unknown) {
  const body = input as {
    cameraId?: number;
    healthStatus?: HealthStatus;
    startedAt?: string;
    metadata?: Record<string, unknown>;
  };
  if (body.cameraId == null) throw new Error('cameraId required');
  if (!body.healthStatus) throw new Error('healthStatus required');
  return recordHealthEvent(body.cameraId, body.healthStatus, body.startedAt, body.metadata ?? {});
}

export function listCameraHealth(organizationId: number) {
  return getCameraHealthGrid(organizationId);
}

export function listProcessingConfigs(organizationId: number) {
  ensureProcessingConfigsForOrg(organizationId);
  return orgCameras(organizationId)
    .map((c) => processingConfigs.get(c.id))
    .filter((c): c is ProcessingConfig => Boolean(c));
}

export function getCameraHealth(cameraId: number) {
  const camera = cameraById(cameraId);
  if (!camera) throw new Error('Camera not found');
  ensureProcessingConfigsForOrg(camera.organizationId);
  const row = getCameraHealthGrid(camera.organizationId).find((r) => r.camera.id === cameraId);
  if (!row) throw new Error('Camera health row not found');
  return row;
}

export function getOrCreateProcessingConfig(cameraId: number) {
  return upsertProcessingConfig(cameraId, {});
}

export function patchProcessingConfig(cameraId: number, patch: unknown) {
  return upsertProcessingConfig(cameraId, (patch ?? {}) as Partial<ProcessingConfig>);
}

export function applyPurposeDefaults(cameraId: number) {
  const cam = cameraById(cameraId);
  if (!cam) throw new Error('Camera not found');
  return upsertProcessingConfig(cameraId, {
    sampleRate: defaultSampleRate(cam.purpose),
    enabledSignals: defaultEnabledSignals(cam.purpose),
  });
}

