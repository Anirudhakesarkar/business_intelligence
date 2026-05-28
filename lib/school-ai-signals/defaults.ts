
import type { CameraPurpose } from '../school-foundation/types';
import type { SignalType } from './types';

export const CORE_SIGNALS: SignalType[] = [
  'PersonCount', 'AdultPresent', 'TeacherPresent', 'Running', 'Loitering', 'Offline', 'Tamper',
];

export const PURPOSE_SIGNALS: Record<CameraPurpose, SignalType[]> = {
  Classroom: ['PersonCount', 'TeacherPresent', 'TeacherNearBoard', 'TeacherSeatedIdle', 'ClassStartTime', 'ClassEndTime', 'RoomOccupied', 'RoomEmpty'],
  Gate: ['PersonCount', 'CrowdDensity', 'VehicleQueue', 'StaffPresentAtGate', 'DispersalDelay'],
  Corridor: ['PersonCount', 'Running', 'Loitering', 'CrowdDensity', 'StaffPresentAtCorridor'],
  Staircase: ['PersonCount', 'Running', 'Loitering', 'Fall'],
  Playground: ['PersonCount', 'Running', 'StaffPresentAtPlayground'],
  Lab: ['PersonCount', 'TeacherPresent', 'AdultPresent'],
  Library: ['PersonCount', 'RoomOccupied', 'UsageDuration'],
  Reception: ['PersonCount', 'ReceptionQueue', 'AdultPresent'],
  Parking: ['VehicleQueue', 'PersonCount'],
  RestrictedZone: ['ZoneEntry', 'PersonCount', 'AdultPresent'],
  Compliance: ['FireSmoke', 'Tamper', 'Offline', 'Fall'],
};

export const PURPOSE_FPS: Record<CameraPurpose, number> = {
  Classroom: 2,
  Gate: 3,
  Corridor: 2,
  Staircase: 2,
  Playground: 2,
  Lab: 2,
  Library: 1,
  Reception: 2,
  Parking: 1,
  RestrictedZone: 2,
  Compliance: 1,
};

export function defaultEnabledSignals(purpose: CameraPurpose): SignalType[] {
  return PURPOSE_SIGNALS[purpose] ?? CORE_SIGNALS;
}

export function defaultSampleRate(purpose: CameraPurpose): number {
  return PURPOSE_FPS[purpose] ?? 1;
}
