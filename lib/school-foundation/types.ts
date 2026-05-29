export type CameraStatus = 'Active' | 'Inactive' | 'Offline' | 'Maintenance';
export type CameraPurpose =
  | 'Classroom' | 'Gate' | 'Corridor' | 'Staircase' | 'Playground' | 'Lab'
  | 'Library' | 'Reception' | 'Parking' | 'RestrictedZone' | 'Compliance';
export type DayType = 'WorkingDay' | 'Holiday' | 'ExamDay' | 'EventDay' | 'HalfDay' | 'SpecialSchedule';
export type ProcessOwner = 'Academic' | 'Discipline' | 'Compliance' | 'ParentExperience' | 'StudentOccupancy' | 'StaffDeployment';
export type Criticality = 'Low' | 'Medium' | 'High' | 'Critical';
export type RiskCategory = 'Staircase' | 'Gate' | 'Lab' | 'Playground' | 'ServerRoom' | 'FireExit' | 'Restricted' | 'Parking' | 'BusBay';

export type Site = { id: number; organizationId: number; name: string; address?: string; isActive: boolean };
export type Building = { id: number; siteId: number; name: string; isActive: boolean };
export type Floor = { id: number; buildingId: number; name: string; levelNo: number };
export type Zone = { id: number; floorId?: number; organizationId?: number; name: string; zoneType: string; isRiskZone: boolean; riskCategory?: RiskCategory; capacity?: number };
export type Room = { id: number; zoneId?: number; roomCode: string; roomName: string; roomType: string; capacity: number; isActive: boolean };
export type SchoolCamera = {
  id: number; organizationId: number; zoneId?: number; roomId?: number;
  cameraCode: string; name: string; streamUrl: string; purpose: CameraPurpose;
  processOwner: ProcessOwner; criticality: Criticality;
  activeFrom?: string; activeTo?: string; status: CameraStatus; metadata?: Record<string, unknown>;
};
export type SchoolClass = { id: number; organizationId: number; name: string; sortOrder: number; isActive: boolean };
export type Section = { id: number; classId: number; name: string; expectedStudentCount: number; isActive: boolean };
export type SectionRoomMapping = { id: number; sectionId: number; roomId: number; isPrimary: boolean; createdAt: string };
export type Subject = { id: number; organizationId: number; name: string; subjectCode?: string; isActive: boolean };
export type Teacher = { id: number; organizationId: number; employeeCode?: string; name: string; email?: string; phone?: string; isActive: boolean };
export type StaffMember = { id: number; organizationId: number; employeeCode?: string; name: string; role: string; phone?: string; isActive: boolean };
export type CalendarDay = { id: number; organizationId: number; calendarDate: string; dayType: DayType; label?: string; timingOverride?: Record<string, unknown> };
export type TimeWindow = { id: number; organizationId: number; name: string; windowType: string; startTime: string; endTime: string; isActive: boolean };
export type TimetableEntry = {
  id: number; organizationId: number; sectionId: number; subjectId?: number; roomId: number;
  teacherId?: number; periodType: string; dayOfWeek: number; startTime: string; endTime: string; isActive: boolean;
};
export type DutyRoster = {
  id: number; organizationId: number; staffMemberId: number; zoneId?: number;
  dutyType: string; dayOfWeek: number; startTime: string; endTime: string; isCriticalWindow: boolean; isActive: boolean;
};
export type AuditEntry = {
  id: number; actorId?: number; action: string; entityType: string; entityId?: number;
  beforeData?: unknown; afterData?: unknown; ipAddress?: string; userAgent?: string; createdAt: string;
};

export type ComplianceConfig = {
  organizationId: number;
  safetyRules: string[];
  restrictedZoneIds: number[];
  auditChecklist: { id: string; label: string; required: boolean }[];
  playgroundCameraWaiver?: boolean;
  updatedAt: string;
};

export type TeachingZones = {
  boardPolygon?: number[][];
  deskPolygon?: number[][];
};

export type SetupNextAction = {
  label: string;
  href: string;
  reason: string;
};

export type CalendarSummary = {
  totalDays: number;
  workingDays: number;
  holidays: number;
  examDays: number;
  eventDays: number;
  halfDays: number;
  specialDays: number;
};

export type SetupHealth = {
  completionPercent: number;
  camerasMapped: { complete: number; total: number };
  roomsConfigured: { complete: number; total: number };
  timetableEntries: number;
  rosterEntries: number;
  calendarDays: number;
  isReadyForPhase2: boolean;
  missing: string[];
  nextAction: SetupNextAction | null;
  calendarSummary: CalendarSummary;
};
