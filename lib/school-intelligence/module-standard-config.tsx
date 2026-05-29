'use client';

import {
  Activity,
  AlertTriangle,
  BookOpen,
  Building,
  CalendarClock,
  Clock,
  DoorOpen,
  Flame,
  LayoutGrid,
  ShieldAlert,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ScoreModuleKey } from '@/lib/school-score-engine/types';
import type {
  SIMetricCard,
  SIObservation,
  SIObservationTypeConfig,
  SIStandardModuleConfig,
} from '@/lib/school-intelligence/module-standard/types';

function icon(Icon: LucideIcon, className: string) {
  return <Icon className={className} />;
}

function count(obs: SIObservation[], fn: (o: SIObservation) => boolean) {
  return obs.filter(fn).length;
}

function priorityCount(obs: SIObservation[]) {
  return count(obs, (o) => o.severity === 'Critical' || o.severity === 'High');
}

function criticalCount(obs: SIObservation[]) {
  return count(obs, (o) => o.severity === 'Critical');
}

function typeCount(obs: SIObservation[], types: string[]) {
  return count(obs, (o) => types.includes(o.type));
}

function metrics(
  obs: SIObservation[],
  c2: { label: string; value: number; tone?: SIMetricCard['tone'] },
  c3: { label: string; value: number; tone?: SIMetricCard['tone'] },
  c4: { label: string; value: number | string; tone?: SIMetricCard['tone'] },
): SIMetricCard[] {
  return [
    { label: 'Observations', value: obs.length },
    { label: c2.label, value: c2.value, tone: c2.tone ?? (c2.value > 0 ? 'warn' : 'default') },
    { label: c3.label, value: c3.value, tone: c3.tone ?? (c3.value > 0 ? 'warn' : 'default') },
    { label: c4.label, value: c4.value, tone: c4.tone },
  ];
}

function cfg(
  id: string,
  breadcrumb: string,
  scoreTitle: string,
  scoreModuleKey: ScoreModuleKey,
  observationTypes: SIObservationTypeConfig[],
  typeIcons: Record<string, React.ReactNode>,
  metricCards: SIStandardModuleConfig['metricCards'],
  options?: Pick<
    SIStandardModuleConfig,
    'eventTypeAliases' | 'emptyFeedMessage' | 'demoSeedAllTypes' | 'intelligenceModule'
  >,
): SIStandardModuleConfig {
  return {
    id,
    breadcrumb,
    scoreTitle,
    scoreModuleKey,
    eventTypes: observationTypes.map((t) => t.type),
    observationTypes,
    typeIcons,
    metricCards,
    ...options,
  };
}

const CLASSROOM_ACTIVITY_TYPES = ['ClassroomActivityDetection'] as const;

const teacherProductivityTypes: SIObservationTypeConfig[] = [
  {
    type: 'ClassroomActivityDetection',
    label: 'Classroom activity',
    description:
      'Detect whether the classroom is active, empty, unattended, overcrowded, or idle.',
    severity: 'Medium',
    defaultSummary: 'Classroom state does not match expected activity for this period.',
    demoSummaries: [
      'Classroom reads active — teaching motion and occupancy within expected range.',
      'Room appears empty during a scheduled teaching period.',
      'Classroom unattended — students present without an adult in frame.',
      'Overcrowded classroom versus nominal capacity for the period.',
      'Classroom idle — low activity versus timetable expectation.',
    ],
  },
  {
    type: 'TeacherPresenceDetection',
    label: 'Teacher presence',
    description: 'Detect adult/teacher presence in classroom during scheduled period.',
    severity: 'High',
    defaultSummary: 'No adult detected in room during scheduled teacher period.',
    isHigh: true,
    demoSummaries: [
      'No adult detected in room during scheduled teacher period.',
      'Teacher presence confirmed and aligned with timetable assignment.',
    ],
  },
  {
    type: 'TimetableMapping',
    label: 'Timetable mapping',
    description: 'Compare class camera activity with timetable.',
    severity: 'Medium',
    defaultSummary: 'Camera activity does not match the published period for this room.',
    demoSummaries: [
      'Camera activity does not match the published period for this room.',
      'Class started late versus timetable — activity began after bell.',
      'Early class end detected before the scheduled period close.',
    ],
  },
  {
    type: 'UnassignedPeriod',
    label: 'Unassigned period',
    description: 'Scheduled period has no teacher assigned in the timetable.',
    severity: 'High',
    defaultSummary: 'Period has no assigned teacher in today’s timetable.',
    isHigh: true,
  },
  {
    type: 'TeacherCoverageGap',
    label: 'Coverage gap',
    description: 'Adjacent periods lack continuous teacher coverage for the section.',
    severity: 'High',
    defaultSummary: 'Coverage gap between consecutive teaching blocks for the same section.',
    isHigh: true,
  },
  {
    type: 'TeacherSupervisionGap',
    label: 'Supervision gap',
    description: 'Students present without assigned supervising teacher during a teaching block.',
    severity: 'Critical',
    defaultSummary: 'Students in classroom with no supervising teacher on roster.',
    isCritical: true,
  },
];

const complianceTypes: SIObservationTypeConfig[] = [
  {
    type: 'CriticalCameraOffline',
    label: 'Camera offline',
    description: 'Compliance-critical camera offline during monitored hours.',
    severity: 'High',
    defaultSummary: 'Critical camera stream unavailable during monitored hours.',
    isHigh: true,
  },
  {
    type: 'LabSupervisionMissing',
    label: 'Lab supervision',
    description: 'Lab session without required supervising staff coverage.',
    severity: 'High',
    defaultSummary: 'Lab supervision missing during scheduled session.',
    isHigh: true,
  },
  {
    type: 'FallDetected',
    label: 'Fall detected',
    description: 'Person fall detected in a compliance-monitored zone.',
    severity: 'Critical',
    defaultSummary: 'Fall detected in compliance-monitored area.',
    isCritical: true,
  },
  {
    type: 'FireExitObstruction',
    label: 'Fire exit obstruction',
    description: 'Fire exit path blocked, narrowed, or obstructed.',
    severity: 'Critical',
    defaultSummary: 'Fire exit path partially obstructed.',
    isCritical: true,
  },
  {
    type: 'RestrictedZoneEntry',
    label: 'Restricted zone',
    description: 'Unauthorized access to a restricted campus area.',
    severity: 'High',
    defaultSummary: 'Unauthorized restricted-zone activity.',
    isHigh: true,
  },
  {
    type: 'Compliance',
    label: 'Compliance check',
    description: 'Deviation from campus safety or policy standards.',
    severity: 'Medium',
    defaultSummary: 'Compliance policy deviation detected.',
  },
  {
    type: 'ServerRoomEntry',
    label: 'Server room',
    description: 'Server room access outside staffed or approved hours.',
    severity: 'High',
    defaultSummary: 'Server room access outside staffed hours.',
    isHigh: true,
  },
  {
    type: 'EmergencyExitCrowding',
    label: 'Exit crowding',
    description: 'Congestion at emergency exits during peak movement.',
    severity: 'Critical',
    defaultSummary: 'Emergency exit crowding during dismissal.',
    isCritical: true,
  },
];

const spaceUtilizationTypes: SIObservationTypeConfig[] = [
  {
    type: 'StudentOccupancy',
    label: 'Occupancy',
    description: 'Compare actual headcount with expected room occupancy.',
    severity: 'Medium',
    defaultSummary: 'Room occupancy deviation from expected headcount.',
  },
  {
    type: 'Overcrowding',
    label: 'Overcrowding',
    description: 'Room count above comfortable capacity for the space.',
    severity: 'High',
    defaultSummary: 'Room above comfortable capacity.',
    isHigh: true,
  },
  {
    type: 'Underuse',
    label: 'Underuse',
    description: 'Scheduled room used below planned occupancy.',
    severity: 'Low',
    defaultSummary: 'Scheduled room under-used versus plan.',
  },
  {
    type: 'SpaceUtilization',
    label: 'Space utilization',
    description: 'How scheduled rooms are used versus the timetable plan.',
    severity: 'Medium',
    defaultSummary: 'Room utilization pattern outside expected band.',
  },
  {
    type: 'RoomUnderused',
    label: 'Room underused',
    description: 'Booked room with lighter usage than expected.',
    severity: 'Low',
    defaultSummary: 'Room scheduled but lightly used.',
  },
  {
    type: 'RoomOverused',
    label: 'Room overused',
    description: 'Usage above typical load for the room type.',
    severity: 'High',
    defaultSummary: 'Room heavily booked beyond typical load.',
    isHigh: true,
  },
  {
    type: 'EmptyRoom',
    label: 'Empty room',
    description: 'No observed activity in a scheduled room window.',
    severity: 'Low',
    defaultSummary: 'No activity in scheduled room window.',
  },
  {
    type: 'LabUnused',
    label: 'Lab unused',
    description: 'Lab block with no observed usage during schedule.',
    severity: 'Medium',
    defaultSummary: 'Lab block with no observed usage.',
  },
];

const parentExperienceTypes: SIObservationTypeConfig[] = [
  {
    type: 'GateCongestion',
    label: 'Gate congestion',
    description: 'Parent queue buildup at the main campus gate.',
    severity: 'High',
    defaultSummary: 'Parent queue congestion at campus gate.',
    isHigh: true,
  },
  {
    type: 'ParentExperience',
    label: 'Parent experience',
    description: 'Overall parent flow versus the expected pattern.',
    severity: 'Medium',
    defaultSummary: 'Parent flow deviation from expected pattern.',
  },
  {
    type: 'ParentWaitTime',
    label: 'Wait time',
    description: 'Extended parent wait at pickup or reception.',
    severity: 'Medium',
    defaultSummary: 'Extended parent wait at pickup zone.',
  },
  {
    type: 'PickupDelay',
    label: 'Pickup delay',
    description: 'Pickup window running behind the planned schedule.',
    severity: 'High',
    defaultSummary: 'Pickup window delay versus plan.',
    isHigh: true,
  },
  {
    type: 'ArrivalDelay',
    label: 'Arrival delay',
    description: 'Arrival window slower than the campus baseline.',
    severity: 'Medium',
    defaultSummary: 'Arrival window slower than baseline.',
  },
  {
    type: 'DispersalCongestion',
    label: 'Dispersal congestion',
    description: 'Pickup-window congestion at dispersal points.',
    severity: 'High',
    defaultSummary: 'Dispersal congestion during pickup window.',
    isHigh: true,
  },
  {
    type: 'VehicleStudentOverlap',
    label: 'Vehicle overlap',
    description: 'Vehicles too close to the pedestrian pickup lane.',
    severity: 'High',
    defaultSummary: 'Vehicle proximity to pedestrian pickup lane.',
    isHigh: true,
  },
];

export const MODULE_STANDARD_CONFIGS: Record<string, SIStandardModuleConfig> = {
  compliance: cfg(
    'compliance',
    'Compliance',
    'Compliance score',
    'compliance',
    complianceTypes,
    {
      CriticalCameraOffline: icon(ShieldAlert, 'h-3.5 w-3.5 text-amber-400'),
      LabSupervisionMissing: icon(ShieldAlert, 'h-3.5 w-3.5 text-orange-400'),
      FallDetected: icon(AlertTriangle, 'h-3.5 w-3.5 text-red-400'),
      FireExitObstruction: icon(Flame, 'h-3.5 w-3.5 text-red-400'),
      RestrictedZoneEntry: icon(ShieldAlert, 'h-3.5 w-3.5 text-orange-400'),
      Compliance: icon(ShieldAlert, 'h-3.5 w-3.5 text-amber-400'),
      ServerRoomEntry: icon(ShieldAlert, 'h-3.5 w-3.5 text-orange-400'),
      EmergencyExitCrowding: icon(DoorOpen, 'h-3.5 w-3.5 text-red-400'),
    },
    (obs) =>
      metrics(
        obs,
        { label: 'Critical observations', value: criticalCount(obs), tone: criticalCount(obs) > 0 ? 'critical' : 'default' },
        { label: 'Open violations', value: count(obs, (o) => o.status === 'Open' || o.status === 'Observed') },
        {
          label: 'Clear checks',
          value: count(obs, (o) => o.status === 'Resolved'),
        },
      ),
    {
      intelligenceModule: 'Compliance',
      emptyFeedMessage: 'No compliance observations for this period.',
    },
  ),

  'space-utilization': cfg(
    'space-utilization',
    'Space Utilization',
    'Space utilization score',
    'space',
    spaceUtilizationTypes,
    {
      StudentOccupancy: icon(Users, 'h-3.5 w-3.5 text-sky-400'),
      Overcrowding: icon(AlertTriangle, 'h-3.5 w-3.5 text-orange-400'),
      Underuse: icon(Building, 'h-3.5 w-3.5 text-slate-400'),
      SpaceUtilization: icon(LayoutGrid, 'h-3.5 w-3.5 text-sky-400'),
      RoomUnderused: icon(Building, 'h-3.5 w-3.5 text-slate-400'),
      RoomOverused: icon(LayoutGrid, 'h-3.5 w-3.5 text-orange-400'),
      EmptyRoom: icon(Building, 'h-3.5 w-3.5 text-slate-500'),
      LabUnused: icon(BookOpen, 'h-3.5 w-3.5 text-amber-400'),
    },
    (obs) =>
      metrics(
        obs,
        {
          label: 'Overcrowding',
          value: typeCount(obs, ['Overcrowding', 'RoomOverused']),
        },
        {
          label: 'Under-used',
          value: typeCount(obs, ['Underuse', 'RoomUnderused', 'EmptyRoom', 'LabUnused']),
        },
        {
          label: 'Avg utilization',
          value: obs.length > 0 ? `${Math.min(100, 40 + obs.length * 8)}%` : '—',
        },
      ),
    {
      intelligenceModule: 'SpaceUtilization',
      eventTypeAliases: {
        UnderOccupancy: 'Underuse',
        EmptyScheduledRoom: 'EmptyRoom',
        CapacityExceeded: 'Overcrowding',
        CorridorOverload: 'Overcrowding',
      },
      emptyFeedMessage: 'No space utilization observations for this period.',
    },
  ),

  'parent-experience': cfg(
    'parent-experience',
    'Parent Experience',
    'Parent experience score',
    'parent',
    parentExperienceTypes,
    {
      GateCongestion: icon(Users, 'h-3.5 w-3.5 text-orange-400'),
      ParentExperience: icon(UserCheck, 'h-3.5 w-3.5 text-sky-400'),
      ParentWaitTime: icon(Clock, 'h-3.5 w-3.5 text-amber-400'),
      PickupDelay: icon(Clock, 'h-3.5 w-3.5 text-orange-400'),
      ArrivalDelay: icon(Clock, 'h-3.5 w-3.5 text-amber-400'),
      DispersalCongestion: icon(Users, 'h-3.5 w-3.5 text-orange-400'),
      VehicleStudentOverlap: icon(AlertTriangle, 'h-3.5 w-3.5 text-red-400'),
    },
    (obs) =>
      metrics(
        obs,
        {
          label: 'Congestion events',
          value: typeCount(obs, ['GateCongestion', 'DispersalCongestion']),
        },
        {
          label: 'Arrival/dispersal issues',
          value: typeCount(obs, ['ArrivalDelay', 'VehicleStudentOverlap', 'ParentWaitTime', 'PickupDelay']),
        },
        { label: 'High priority', value: priorityCount(obs) },
      ),
    {
      intelligenceModule: 'ParentExperience',
      eventTypeAliases: {
        DispersalDelay: 'DispersalCongestion',
        ReceptionQueueHigh: 'ParentWaitTime',
        ArrivalCongestion: 'GateCongestion',
        VehicleStudentOverlap: 'VehicleStudentOverlap',
      },
      emptyFeedMessage: 'No parent experience observations for this period.',
    },
  ),

  'teacher-productivity': cfg(
    'teacher-productivity',
    'Teacher & Staff Management',
    'Teacher & staff management score',
    'teacher',
    teacherProductivityTypes,
    {
      ClassroomActivityDetection: icon(Activity, 'h-3.5 w-3.5 text-sky-400'),
      TeacherPresenceDetection: icon(UserCheck, 'h-3.5 w-3.5 text-indigo-400'),
      TimetableMapping: icon(CalendarClock, 'h-3.5 w-3.5 text-amber-400'),
      UnassignedPeriod: icon(BookOpen, 'h-3.5 w-3.5 text-orange-400'),
      TeacherCoverageGap: icon(Clock, 'h-3.5 w-3.5 text-orange-400'),
      TeacherSupervisionGap: icon(ShieldAlert, 'h-3.5 w-3.5 text-red-400'),
    },
    (obs) => {
      const gaps = typeCount(obs, ['UnassignedPeriod', 'TeacherCoverageGap', 'TeacherSupervisionGap']);
      const presenceIssues = typeCount(obs, ['TeacherPresenceDetection']);
      const classroomIssues = typeCount(obs, [...CLASSROOM_ACTIVITY_TYPES]);
      const timetableIssues = typeCount(obs, ['TimetableMapping']);
      const n = Math.max(obs.length, 8);
      const conductedPct = Math.max(72, 100 - Math.round(((classroomIssues + timetableIssues) / n) * 28));
      const presencePct = Math.max(68, 100 - Math.round((presenceIssues / n) * 32));
      const onTimePct = Math.max(70, 100 - Math.round((timetableIssues / n) * 30));
      return [
        { label: 'Class conducted', value: `${conductedPct}%` },
        { label: 'Teacher presence', value: `${presencePct}%` },
        { label: 'On-time start', value: `${onTimePct}%` },
        {
          label: 'Supervision gaps',
          value: gaps,
          tone: gaps > 0 ? 'warn' : 'default',
        },
      ];
    },
    {
      intelligenceModule: 'TeacherProductivity',
      eventTypeAliases: {
        TeacherSupervisionGap: 'TeacherSupervisionGap',
        ClassUnattended: 'ClassroomActivityDetection',
        EmptyScheduledRoom: 'ClassroomActivityDetection',
        LowTeachingZoneActivity: 'ClassroomActivityDetection',
        TeacherMissing: 'TeacherPresenceDetection',
        TeacherLate: 'TimetableMapping',
        EarlyClassEnd: 'TimetableMapping',
        LateClassStart: 'TimetableMapping',
        MissedPeriod: 'TimetableMapping',
        PeriodSkipped: 'TimetableMapping',
        UnassignedPeriod: 'UnassignedPeriod',
        TeacherCoverageGap: 'TeacherCoverageGap',
      },
      emptyFeedMessage:
        'No classroom activity, presence, timetable, or coverage observations for this period.',
    },
  ),
};

export function getModuleConfig(key: string): SIStandardModuleConfig {
  const config = MODULE_STANDARD_CONFIGS[key];
  if (!config) throw new Error(`Unknown module config: ${key}`);
  return config;
}
