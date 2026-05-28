
import type { SchoolZone } from './types';

export const DEMO_ZONES: SchoolZone[] = [
  {
    id: 'z-main-gate',
    name: 'Main Gate',
    building: 'Campus',
    zoneType: 'entrance',
    cameraCount: 4,
    sensitivity: 'high',
    restrictedAfterHours: true,
    linkedCameraIds: ['cam-g1', 'cam-g2'],
    capacityWarning: 80,
    capacityCritical: 120,
  },
  {
    id: 'z-corridor-a',
    name: 'Block A Corridor',
    building: 'Block A',
    floor: '2',
    zoneType: 'corridor',
    cameraCount: 6,
    sensitivity: 'normal',
    restrictedAfterHours: true,
    linkedCameraIds: ['cam-a1'],
  },
  {
    id: 'z-playground',
    name: 'Playground',
    zoneType: 'playground',
    cameraCount: 3,
    sensitivity: 'normal',
    restrictedAfterHours: true,
    linkedCameraIds: ['cam-p1'],
    capacityWarning: 150,
    capacityCritical: 200,
  },
  {
    id: 'z-parking',
    name: 'Staff Parking',
    zoneType: 'parking',
    cameraCount: 2,
    sensitivity: 'low',
    restrictedAfterHours: false,
    linkedCameraIds: ['cam-pk1'],
  },
];
