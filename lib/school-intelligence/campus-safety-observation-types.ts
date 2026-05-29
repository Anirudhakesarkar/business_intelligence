export type CampusSafetyObservationType = {
  type: string;
  label: string;
  description: string;
  isCritical?: boolean;
  isHigh?: boolean;
};

export const CAMPUS_SAFETY_OBSERVATION_TYPES: CampusSafetyObservationType[] = [
  {
    type: 'FallDetected',
    label: 'Fall detected',
    description: 'Person fall detected in monitored campus zones.',
    isCritical: true,
  },
  {
    type: 'FireSmokeDetected',
    label: 'Fire / smoke',
    description: 'Smoke or fire signature observed in camera coverage.',
    isCritical: true,
  },
  {
    type: 'FireExitObstruction',
    label: 'Fire exit obstruction',
    description: 'Fire exit path blocked, narrowed, or obstructed.',
    isCritical: true,
  },
  {
    type: 'EmergencyExitCrowding',
    label: 'Exit crowding',
    description: 'Crowding that blocks or slows emergency exit routes.',
    isCritical: true,
  },
  {
    type: 'CriticalCameraOffline',
    label: 'Camera offline',
    description: 'Safety-critical camera offline during monitored hours.',
    isHigh: true,
  },
  {
    type: 'RestrictedZoneEntry',
    label: 'Restricted zone',
    description: 'Entry into a restricted area outside approved hours.',
    isHigh: true,
  },
  {
    type: 'ServerRoomEntry',
    label: 'Server room',
    description: 'Server room access outside staffed or approved hours.',
    isHigh: true,
  },
  {
    type: 'VehicleStudentOverlap',
    label: 'Vehicle overlap',
    description: 'Vehicles too close to student pedestrian zones.',
    isHigh: true,
  },
  {
    type: 'UnsafeClimbing',
    label: 'Unsafe climbing',
    description: 'Climbing or elevated play outside permitted activity.',
  },
  {
    type: 'RunningDetected',
    label: 'Running',
    description: 'Running in corridors during class transitions.',
  },
  {
    type: 'Loitering',
    label: 'Loitering',
    description: 'Extended loitering in monitored campus zones.',
  },
];

export const CAMPUS_SAFETY_EVENT_TYPES = CAMPUS_SAFETY_OBSERVATION_TYPES.map((t) => t.type);

export const CAMPUS_SAFETY_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  CAMPUS_SAFETY_OBSERVATION_TYPES.map((t) => [t.type, t.label]),
);

export const CAMPUS_SAFETY_CRITICAL_TYPES = CAMPUS_SAFETY_OBSERVATION_TYPES.filter((t) => t.isCritical).map(
  (t) => t.type,
);

export const CAMPUS_SAFETY_HIGH_TYPES = CAMPUS_SAFETY_OBSERVATION_TYPES.filter((t) => t.isHigh).map(
  (t) => t.type,
);
