export type SignalType =
  | 'PersonCount' | 'PersonTracking' | 'AdultPresent' | 'TeacherPresent' | 'CrowdDensity'
  | 'Running' | 'Loitering' | 'ZoneEntry' | 'Fall' | 'FireSmoke' | 'Tamper' | 'Offline'
  | 'TeacherNearBoard' | 'TeacherSeatedIdle' | 'SubstituteTeacherPresent' | 'ClassStartTime' | 'ClassEndTime'
  | 'RoomOccupied' | 'RoomEmpty' | 'UsageDuration'
  | 'VehicleQueue' | 'ReceptionQueue' | 'DispersalDelay'
  | 'StaffPresentAtGate' | 'StaffPresentAtCorridor' | 'StaffPresentAtPlayground';

export type HealthStatus = 'Online' | 'Offline' | 'Unstable' | 'Tampered' | 'Maintenance';
export type WorkerStatus = 'Healthy' | 'Unhealthy' | 'Stale';

export type AiWorker = {
  id: number;
  workerKey: string;
  workerType: string;
  version: string;
  status: WorkerStatus;
  capabilities: string[];
  registeredAt: string;
  lastHeartbeatAt?: string;
};

export type ProcessingConfig = {
  cameraId: number;
  sampleRate: number;
  minConfidence: number;
  enabledSignals: SignalType[];
  zonePolygons: Record<string, unknown>;
  snapshotEnabled: boolean;
  activeProcessing: boolean;
  updatedAt: string;
};

export type SignalBatch = {
  id: number;
  batchKey: string;
  cameraId: number;
  workerId?: number;
  modelVersion: string;
  frameCount: number;
  startedAt: string;
  endedAt?: string;
};

export type AiSignal = {
  id: number;
  cameraId: number;
  batchId?: number;
  signalType: SignalType;
  signalValue: number;
  confidence?: number;
  observedAt: string;
  metadata: Record<string, unknown>;
};

export type HealthEvent = {
  id: number;
  cameraId: number;
  healthStatus: HealthStatus;
  startedAt: string;
  endedAt?: string;
  metadata: Record<string, unknown>;
};

export type DiagnosticMedia = {
  id: number;
  cameraId: number;
  mediaType: string;
  storageUrl: string;
  capturedAt: string;
  expiresAt: string;
};

export type RetentionPolicy = {
  organizationId: number;
  signalsDays: number;
  batchesDays: number;
  healthDays: number;
  heartbeatsDays: number;
  snapshotDays: number;
  clipDays: number;
};

export type CameraFreshness = {
  cameraId: number;
  lastSignalAt?: string;
  stale: boolean;
  missingTypes: SignalType[];
};

export type CameraHealthDaily = {
  organizationId: number;
  summaryDate: string;
  healthScore: number;
  inputs: Record<string, unknown>;
};

export type IngestSignalInput = {
  cameraId: number;
  batchId?: number;
  signalType: SignalType;
  signalValue: number;
  confidence?: number;
  observedAt: string;
  metadata?: Record<string, unknown>;
};
