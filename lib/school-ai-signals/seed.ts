import { db } from '../school-foundation/store';
import {
  ensureProcessingConfigsForOrg, ensureRetentionPolicy, ingestSignal, openBatch, recordHeartbeat,
  registerWorker, resetAiSignalsStore,
} from './store';
import type { SignalType } from './types';

const rand = (min: number, max: number) => min + Math.random() * (max - min);

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

  const end = new Date();
  const start = new Date(end.getTime() - 2 * 60 * 60 * 1000);
  let signalCount = 0;
  const typesByPurpose: Record<string, SignalType[]> = {
    Classroom: ['PersonCount', 'TeacherPresent', 'RoomOccupied', 'TeacherNearBoard', 'ClassStartTime', 'ClassEndTime', 'SubstituteTeacherPresent'],
    Gate: ['PersonCount', 'VehicleQueue', 'CrowdDensity', 'StaffPresentAtGate'],
    Corridor: ['PersonCount', 'Running', 'Loitering'],
    Playground: ['PersonCount', 'Running', 'StaffPresentAtPlayground'],
    Lab: ['PersonCount', 'TeacherPresent'],
    RestrictedZone: ['ZoneEntry', 'PersonCount'],
    Staircase: ['Running', 'PersonCount', 'Fall'],
    Reception: ['ReceptionQueue', 'PersonCount'],
  };

  for (const cam of cameras) {
    const batch = openBatch({ batchKey: `seed-${cam.id}-${Date.now()}`, cameraId: cam.id, workerId: w1.id });
    const types = typesByPurpose[cam.purpose] ?? ['PersonCount', 'AdultPresent'];
    let t = new Date(start);
    while (t <= end) {
      for (const st of types) {
        let value = rand(0, 1);
        if (st === 'PersonCount') value = Math.round(rand(8, cam.purpose === 'Classroom' ? 38 : 22));
        if (st === 'TeacherPresent') value = cam.id % 5 === 0 ? 0 : rand(0.7, 1);
        if (st === 'Running') value = cam.purpose === 'Corridor' && cam.id % 3 === 0 ? rand(0.6, 1) : rand(0, 0.2);
        if (st === 'VehicleQueue') value = cam.purpose === 'Gate' ? rand(5, 18) : 0;
        if (st === 'StaffPresentAtGate') value = cam.purpose === 'Gate' && t.getHours() < 8 ? 0 : rand(0.8, 1);
        if (st === 'Loitering') value = cam.id % 7 === 0 ? rand(0.5, 1) : rand(0, 0.15);

        if (st === 'ZoneEntry' && cam.purpose === 'RestrictedZone') value = rand(0.7, 1);
        if (st === 'Fall' && cam.purpose === 'Staircase' && cam.id % 4 === 0) value = rand(0.65, 1);
        if (st === 'FireSmoke' && cam.id % 40 === 0) value = rand(0.75, 1);
        if (st === 'TeacherNearBoard' && cam.purpose === 'Classroom') value = cam.id % 4 === 0 ? rand(0.1, 0.3) : rand(0.5, 1);
        if (st === 'ClassStartTime' && cam.purpose === 'Classroom') value = cam.id % 6 === 0 ? rand(9, 15) : rand(0, 3);
        if (st === 'ClassEndTime' && cam.purpose === 'Classroom') value = cam.id % 8 === 0 ? rand(0.5, 1) : 0;
        if (st === 'SubstituteTeacherPresent' && cam.purpose === 'Classroom' && cam.id % 9 === 0) value = rand(0.65, 1);
        if (st === 'ReceptionQueue' && cam.purpose === 'Reception') value = rand(4, 12);
        if (st === 'Offline' && cam.id === 3 && t.getHours() >= 13) value = 1;
        ingestSignal({
          cameraId: cam.id,
          batchId: batch.id,
          signalType: st,
          signalValue: value,
          confidence: rand(0.72, 0.98),
          observedAt: t.toISOString(),
          metadata: { seed: true, purpose: cam.purpose },
        });
        signalCount++;
      }
      t = new Date(t.getTime() + 45 * 1000);
    }
    if (cam.id === 3) {
      ingestSignal({ cameraId: cam.id, signalType: 'Offline', signalValue: 1, confidence: 0.99, observedAt: end.toISOString(), metadata: { seed: true } });
      signalCount++;
    }
  }

  return { workers: 2, camerasSeeded: cameras.length, signals: signalCount };
}
