export type EventSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type EventStatus = 'Open' | 'Acknowledged' | 'Assigned' | 'Resolved';

export type EventType =
  | 'TeacherSupervisionGap' | 'GateCongestion' | 'LabSupervisionMissing' | 'RestrictedZoneEntry'
  | 'CriticalCameraOffline' | 'LateClassStart' | 'EarlyClassEnd' | 'Overcrowding' | 'UnderOccupancy'
  | 'EmptyScheduledRoom' | 'MissedPeriod' | 'ClassNotConducted' | 'StaffMissingAtGate'
  | 'RoomUnderused' | 'CorridorOverload' | 'RunningDetected' | 'Loitering' | 'UnsafeClimbing'
  | 'ArrivalCongestion' | 'DispersalDelay' | 'VehicleStudentOverlap' | 'ReceptionQueueHigh'
  | 'FireExitObstruction' | 'FallDetected' | 'FireSmokeDetected' | 'StaffMissingAtPlayground'
  | 'WeakDispersalCoverage' | 'LowTeachingZoneActivity' | 'ServerRoomEntry'
  | 'SubstituteTeacherDetected' | 'StudentOutsideClassDuringPeriod' | 'EmergencyExitCrowding';

export type IntelligenceModule =
  | 'Core' | 'TeacherProductivity' | 'StudentOccupancy' | 'AcademicOperations' | 'StaffDeployment'
  | 'SpaceUtilization' | 'Discipline' | 'ParentExperience' | 'Compliance';

export type IntelligenceRule = {
  id: number;
  organizationId: number;
  name: string;
  eventType: EventType;
  module: IntelligenceModule;
  enabled: boolean;
  severityDefault: EventSeverity;
  cooldownSeconds: number;
  version: number;
  createdAt: string;
  updatedAt?: string;
};

export type RuleCondition = {
  id: number;
  ruleId: number;
  conditionType: string;
  parameters: Record<string, unknown>;
  sortOrder: number;
};

export type IntelligenceEvent = {
  id: number;
  organizationId: number;
  ruleId?: number;
  eventType: EventType;
  module: IntelligenceModule;
  severity: EventSeverity;
  status: EventStatus;
  cameraId?: number;
  zoneId?: number;
  roomId?: number;
  classId?: number;
  periodId?: number;
  startedAt: string;
  endedAt?: string;
  confidence?: number;
  evidence: { summary: string; metrics?: Record<string, unknown>; signalIds?: number[] };
  createdAt: string;
  updatedAt?: string;
  assignedTo?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
};

export type EventAcknowledgement = {
  id: number;
  eventId: number;
  userId?: number;
  action: 'ack' | 'assign' | 'resolve';
  note?: string;
  createdAt: string;
};
