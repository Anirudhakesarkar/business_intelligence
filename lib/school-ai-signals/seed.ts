import { db } from '../school-foundation/store';
import {
  ensureProcessingConfigsForOrg, ensureRetentionPolicy, ingestSignal, openBatch, recordHeartbeat,
  registerWorker, resetAiSignalsStore,
} from './store';
import type { SignalType } from './types';

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * Deterministic per-camera signal scenarios.
 * Each index (cam.id % SCENARIOS) maps to a specific alert profile so that
 * every pipeline run reliably produces events for ALL SI modules:
 *
 *   Module coverage guaranteed:
 *   ─ TeacherProductivity : TeacherSupervisionGap, LowTeachingZoneActivity, LateClassStart
 *   ─ SpaceUtilization    : RoomUnderused, Overcrowding
 *   ─ ParentExperience    : GateCongestion, DispersalDelay, VehicleStudentOverlap
 *   ─ Compliance          : CriticalCameraOffline, FireExitObstruction, EmergencyExitCrowding
 *   ─ Discipline          : RunningDetected, Loitering, UnsafeClimbing
 *   ─ CampusSafety        : FallDetected, RestrictedZoneEntry
 */

/** Inject a single signal at a given timestamp offset (minutes from end). */
function inject(
  cameraId: number,
  batchId: number,
  signalType: SignalType,
  signalValue: number,
  offsetMinutes: number,
  endMs: number,
  count: { n: number },
) {
  const observedAt = new Date(endMs - offsetMinutes * 60_000).toISOString();
  ingestSignal({
    cameraId,
    batchId,
    signalType,
    signalValue,
    confidence: rand(0.82, 0.98),
    observedAt,
    metadata: { seed: true },
  });
  count.n++;
}

export function seedDemoAiSignals(organizationId = 1) {
  resetAiSignalsStore();
  ensureRetentionPolicy(organizationId);
  const cameras = db.cameras().filter((c) => c.organizationId === organizationId && c.status === 'Active');
  if (!cameras.length) return { workers: 0, camerasSeeded: 0, signals: 0 };

  ensureProcessingConfigsForOrg(organizationId);
  const w1 = registerWorker({ workerKey: 'edge-gpu-01', workerType: 'detection', version: '2.1.0', capabilities: ['PersonCount', 'Running'] });
  const w2 = registerWorker({ workerKey: 'edge-gpu-02', workerType: 'detection', version: '2.1.0', capabilities: ['TeacherPresent', 'CrowdDensity'] });
  recordHeartbeat(w1.id, { fps: 2.4, queueDepth: 3, gpuUtil: 0.62 });
  recordHeartbeat(w2.id, { fps: 1.8, queueDepth: 1, gpuUtil: 0.48 });

  const endMs = Date.now();
  const count = { n: 0 };

  // ─── Group cameras by purpose ──────────────────────────────────────────────
  const classrooms    = cameras.filter((c) => c.purpose === 'Classroom');
  const gates         = cameras.filter((c) => c.purpose === 'Gate');
  const corridors     = cameras.filter((c) => c.purpose === 'Corridor');
  const staircases    = cameras.filter((c) => c.purpose === 'Staircase');
  const playgrounds   = cameras.filter((c) => c.purpose === 'Playground');
  const labs          = cameras.filter((c) => c.purpose === 'Lab');
  const restricted    = cameras.filter((c) => c.purpose === 'RestrictedZone');
  const receptions    = cameras.filter((c) => c.purpose === 'Reception');
  const firexits      = cameras.filter((c) => c.purpose === 'Compliance');

  // ─── Baseline heartbeat signals (all cameras, normal range) ───────────────
  const typesByPurpose: Record<string, SignalType[]> = {
    Classroom:      ['PersonCount', 'TeacherPresent', 'RoomOccupied', 'TeacherNearBoard', 'ClassStartTime'],
    Gate:           ['PersonCount', 'VehicleQueue', 'CrowdDensity', 'StaffPresentAtGate'],
    Corridor:       ['PersonCount', 'Running', 'Loitering', 'CrowdDensity'],
    Playground:     ['PersonCount', 'Running', 'StaffPresentAtPlayground'],
    Lab:            ['PersonCount', 'TeacherPresent'],
    RestrictedZone: ['ZoneEntry', 'PersonCount'],
    Staircase:      ['Running', 'PersonCount', 'Fall'],
    Reception:      ['ReceptionQueue', 'PersonCount'],
    Compliance:     ['PersonCount', 'CrowdDensity'],
    Parking:        ['PersonCount', 'VehicleQueue'],
  };

  for (const cam of cameras) {
    const batch = openBatch({ batchKey: `seed-${cam.id}-${endMs}`, cameraId: cam.id, workerId: w1.id });
    const types = typesByPurpose[cam.purpose] ?? ['PersonCount'];
    const startMs = endMs - 2 * 60 * 60 * 1000;
    let t = new Date(startMs);
    const end = new Date(endMs);
    while (t <= end) {
      for (const st of types) {
        // Normal baseline values — below alert thresholds
        let value = rand(0, 0.3);
        if (st === 'PersonCount')       value = Math.round(rand(8, 20));
        if (st === 'TeacherPresent')    value = rand(0.75, 0.98);
        if (st === 'TeacherNearBoard')  value = rand(0.55, 0.9);
        if (st === 'ClassStartTime')    value = rand(0, 2);
        if (st === 'RoomOccupied')      value = rand(0.7, 1);
        if (st === 'VehicleQueue')      value = rand(2, 7);
        if (st === 'StaffPresentAtGate') value = rand(0.8, 1);
        if (st === 'CrowdDensity')      value = rand(0.2, 0.5);
        if (st === 'ReceptionQueue')    value = rand(2, 6);
        if (st === 'ZoneEntry')         value = rand(0, 0.2);
        ingestSignal({
          cameraId: cam.id, batchId: batch.id, signalType: st,
          signalValue: value, confidence: rand(0.78, 0.96),
          observedAt: t.toISOString(), metadata: { seed: true, baseline: true },
        });
        count.n++;
      }
      t = new Date(t.getTime() + 45_000);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODULE ALERT SCENARIOS — deterministic, one guaranteed event per module
  // ══════════════════════════════════════════════════════════════════════════

  // ── TEACHER PRODUCTIVITY: TeacherSupervisionGap ──────────────────────────
  // Rule: no_teacher_with_students (minStudents: 5)
  // Need: TeacherPresent=0 AND PersonCount>=5 on a Classroom camera
  if (classrooms.length) {
    const cams = classrooms.slice(0, Math.max(2, Math.ceil(classrooms.length * 0.25)));
    for (const cam of cams) {
      const b = openBatch({ batchKey: `alert-teacher-${cam.id}`, cameraId: cam.id, workerId: w2.id });
      inject(cam.id, b.id, 'TeacherPresent', 0.0, 35, endMs, count);   // teacher absent
      inject(cam.id, b.id, 'PersonCount',    22,  35, endMs, count);   // students present
      inject(cam.id, b.id, 'TeacherPresent', 0.0, 20, endMs, count);
      inject(cam.id, b.id, 'PersonCount',    25,  20, endMs, count);
    }
  }

  // ── TEACHER PRODUCTIVITY: LowTeachingZoneActivity ────────────────────────
  // Rule: signal_threshold(TeacherNearBoard, minValue: 0.25)
  if (classrooms.length > 1) {
    const cams = classrooms.slice(1, Math.max(2, Math.ceil(classrooms.length * 0.3)));
    for (const cam of cams) {
      const b = openBatch({ batchKey: `alert-board-${cam.id}`, cameraId: cam.id, workerId: w2.id });
      inject(cam.id, b.id, 'TeacherNearBoard', 0.12, 50, endMs, count);
      inject(cam.id, b.id, 'TeacherNearBoard', 0.08, 40, endMs, count);
    }
  }

  // ── TEACHER PRODUCTIVITY: LateClassStart ─────────────────────────────────
  // Rule: signal_threshold(ClassStartTime, minValue: 5)
  if (classrooms.length) {
    const cam = classrooms[classrooms.length - 1];
    const b = openBatch({ batchKey: `alert-late-${cam.id}`, cameraId: cam.id, workerId: w1.id });
    inject(cam.id, b.id, 'ClassStartTime', 11.0, 70, endMs, count);  // 11 min late
    inject(cam.id, b.id, 'ClassStartTime',  9.5, 55, endMs, count);
  }

  // ── SPACE UTILIZATION: RoomUnderused ─────────────────────────────────────
  // Rule: person_count_under_expected (ratio: 0.25) — need count < capacity * 0.25
  // Typical capacity 35 → need PersonCount < 9
  if (classrooms.length) {
    const cams = classrooms.slice(0, Math.max(1, Math.ceil(classrooms.length * 0.2)));
    for (const cam of cams) {
      const b = openBatch({ batchKey: `alert-underuse-${cam.id}`, cameraId: cam.id, workerId: w1.id });
      inject(cam.id, b.id, 'PersonCount', 3, 90, endMs, count);
      inject(cam.id, b.id, 'PersonCount', 2, 75, endMs, count);
      inject(cam.id, b.id, 'RoomOccupied', 1, 90, endMs, count);
    }
  }

  // ── SPACE UTILIZATION: Overcrowding ──────────────────────────────────────
  // Rule: person_count_over_capacity (ratio: 1.1) — need count > capacity * 1.1
  // Typical capacity 35 → need PersonCount > 38
  if (classrooms.length > 2) {
    const cam = classrooms[2];
    const b = openBatch({ batchKey: `alert-overc-${cam.id}`, cameraId: cam.id, workerId: w1.id });
    inject(cam.id, b.id, 'PersonCount', 42, 60, endMs, count);
    inject(cam.id, b.id, 'PersonCount', 45, 45, endMs, count);
  }

  // ── PARENT EXPERIENCE: GateCongestion ────────────────────────────────────
  // Rule: gate_queue (minQueue: 10) — need VehicleQueue >= 10
  if (gates.length) {
    for (const cam of gates.slice(0, Math.min(gates.length, 2))) {
      const b = openBatch({ batchKey: `alert-gate-${cam.id}`, cameraId: cam.id, workerId: w1.id });
      inject(cam.id, b.id, 'VehicleQueue', 14, 25, endMs, count);
      inject(cam.id, b.id, 'VehicleQueue', 18, 15, endMs, count);
      inject(cam.id, b.id, 'VehicleQueue', 12, 10, endMs, count);
    }
  }

  // ── PARENT EXPERIENCE: DispersalDelay / VehicleStudentOverlap ────────────
  if (gates.length) {
    const cam = gates[0];
    const b = openBatch({ batchKey: `alert-disp-${cam.id}`, cameraId: cam.id, workerId: w2.id });
    inject(cam.id, b.id, 'PersonCount',   35, 18, endMs, count);
    inject(cam.id, b.id, 'VehicleQueue',  16, 18, endMs, count);  // overlap condition
    inject(cam.id, b.id, 'CrowdDensity', 0.82, 18, endMs, count);
  }

  // ── COMPLIANCE: CriticalCameraOffline ────────────────────────────────────
  // Rule: signal_threshold(Offline, minValue: 0.9)
  // Pick first available camera — guaranteed to exist
  if (cameras.length) {
    const cam = cameras[0];
    const b = openBatch({ batchKey: `alert-offline-${cam.id}`, cameraId: cam.id, workerId: w1.id });
    inject(cam.id, b.id, 'Offline', 1.0, 30, endMs, count);
    inject(cam.id, b.id, 'Offline', 1.0, 20, endMs, count);
    inject(cam.id, b.id, 'Offline', 1.0, 10, endMs, count);
  }

  // ── COMPLIANCE: EmergencyExitCrowding ────────────────────────────────────
  // Rule: signal_threshold(CrowdDensity, minValue: 0.8)
  const complianceCam = firexits.length ? firexits[0]
    : corridors.length ? corridors[0]
    : cameras.length ? cameras[0]
    : null;
  if (complianceCam) {
    const b = openBatch({ batchKey: `alert-exit-${complianceCam.id}`, cameraId: complianceCam.id, workerId: w2.id });
    inject(complianceCam.id, b.id, 'CrowdDensity', 0.87, 40, endMs, count);
    inject(complianceCam.id, b.id, 'CrowdDensity', 0.91, 30, endMs, count);
  }

  // ── COMPLIANCE: FireExitObstruction ──────────────────────────────────────
  // Rule: signal_threshold(PersonCount, minValue: 15) on any camera
  if (corridors.length) {
    const cam = corridors[0];
    const b = openBatch({ batchKey: `alert-fire-${cam.id}`, cameraId: cam.id, workerId: w1.id });
    inject(cam.id, b.id, 'PersonCount', 18, 55, endMs, count);
    inject(cam.id, b.id, 'PersonCount', 21, 45, endMs, count);
  }

  // ── DISCIPLINE: RunningDetected ───────────────────────────────────────────
  // Rule: signal_threshold(Running, minValue: 0.55)
  if (corridors.length) {
    for (const cam of corridors.slice(0, Math.min(corridors.length, 2))) {
      const b = openBatch({ batchKey: `alert-run-${cam.id}`, cameraId: cam.id, workerId: w1.id });
      inject(cam.id, b.id, 'Running', 0.78, 30, endMs, count);
      inject(cam.id, b.id, 'Running', 0.65, 22, endMs, count);
    }
  }

  // ── DISCIPLINE: Loitering ────────────────────────────────────────────────
  // Rule: signal_threshold(Loitering, minValue: 0.5)
  if (corridors.length) {
    const cam = corridors[corridors.length - 1];
    const b = openBatch({ batchKey: `alert-loit-${cam.id}`, cameraId: cam.id, workerId: w2.id });
    inject(cam.id, b.id, 'Loitering', 0.68, 65, endMs, count);
    inject(cam.id, b.id, 'Loitering', 0.72, 50, endMs, count);
  }

  // ── DISCIPLINE: UnsafeClimbing ────────────────────────────────────────────
  // Rule: signal_threshold(Running, minValue: 0.7) — reuses Running signal
  if (staircases.length) {
    const cam = staircases[0];
    const b = openBatch({ batchKey: `alert-climb-${cam.id}`, cameraId: cam.id, workerId: w1.id });
    inject(cam.id, b.id, 'Running', 0.82, 80, endMs, count);
    inject(cam.id, b.id, 'Running', 0.76, 70, endMs, count);
  }

  // ── CAMPUS SAFETY: FallDetected ──────────────────────────────────────────
  // Rule: signal_threshold(Fall, minValue: 0.65)
  if (staircases.length) {
    const cam = staircases[0];
    const b = openBatch({ batchKey: `alert-fall-${cam.id}`, cameraId: cam.id, workerId: w2.id });
    inject(cam.id, b.id, 'Fall', 0.81, 95, endMs, count);
    inject(cam.id, b.id, 'Fall', 0.74, 88, endMs, count);
  } else if (corridors.length) {
    const cam = corridors[0];
    const b = openBatch({ batchKey: `alert-fall-${cam.id}`, cameraId: cam.id, workerId: w2.id });
    inject(cam.id, b.id, 'Fall', 0.79, 95, endMs, count);
  }

  // ── CAMPUS SAFETY: RestrictedZoneEntry ───────────────────────────────────
  // Rule: signal_threshold(ZoneEntry, minValue: 0.6)
  if (restricted.length) {
    for (const cam of restricted.slice(0, Math.min(restricted.length, 2))) {
      const b = openBatch({ batchKey: `alert-rzone-${cam.id}`, cameraId: cam.id, workerId: w2.id });
      inject(cam.id, b.id, 'ZoneEntry', 0.88, 45, endMs, count);
      inject(cam.id, b.id, 'ZoneEntry', 0.77, 35, endMs, count);
    }
  }

  // ── STAFF DEPLOYMENT: StaffMissingAtGate ─────────────────────────────────
  // Rule: staff_absent_roster — evaluated against duty rosters, no signal needed
  // But inject StaffPresentAtGate=0 as supporting evidence signal
  if (gates.length) {
    const cam = gates[gates.length - 1];
    const b = openBatch({ batchKey: `alert-staff-${cam.id}`, cameraId: cam.id, workerId: w1.id });
    inject(cam.id, b.id, 'StaffPresentAtGate', 0.0, 28, endMs, count);
    inject(cam.id, b.id, 'StaffPresentAtGate', 0.0, 18, endMs, count);
  }

  // ── PLAYGROUND: StaffMissingAtPlayground ─────────────────────────────────
  if (playgrounds.length) {
    const cam = playgrounds[0];
    const b = openBatch({ batchKey: `alert-play-${cam.id}`, cameraId: cam.id, workerId: w1.id });
    inject(cam.id, b.id, 'StaffPresentAtPlayground', 0.0, 60, endMs, count);
    inject(cam.id, b.id, 'PersonCount', 18, 60, endMs, count);
  }

  // ── LAB SUPERVISION: LabSupervisionMissing ────────────────────────────────
  if (labs.length) {
    const cam = labs[0];
    const b = openBatch({ batchKey: `alert-lab-${cam.id}`, cameraId: cam.id, workerId: w2.id });
    inject(cam.id, b.id, 'TeacherPresent', 0.0, 42, endMs, count);
    inject(cam.id, b.id, 'PersonCount',   14, 42, endMs, count);
  }

  // ── RECEPTION: ReceptionQueueHigh ─────────────────────────────────────────
  // Rule: signal_threshold(ReceptionQueue, minValue: 8)
  if (receptions.length) {
    const cam = receptions[0];
    const b = openBatch({ batchKey: `alert-recep-${cam.id}`, cameraId: cam.id, workerId: w1.id });
    inject(cam.id, b.id, 'ReceptionQueue', 11, 35, endMs, count);
    inject(cam.id, b.id, 'ReceptionQueue',  9, 25, endMs, count);
  }

  return { workers: 2, camerasSeeded: cameras.length, signals: count.n };
}
