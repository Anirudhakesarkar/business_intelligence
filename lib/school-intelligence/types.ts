export type SIDateRange = '24h' | '7d' | '30d';

export type SIFilters = {
  organizationId: string;
  siteId: string;
  dateRange: SIDateRange;
};

export type SchoolZoneType =
  | 'entrance' | 'corridor' | 'classroom' | 'playground'
  | 'parking' | 'restricted' | 'common' | 'washroom';

export type BellPeriod = {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
};

export type SiteBellSchedule = {
  siteId: string;
  timezone: string;
  weekdays: Record<string, BellPeriod[]>;
};

export type SchoolZone = {
  id: string;
  name: string;
  building?: string;
  floor?: string;
  zoneType: SchoolZoneType;
  cameraCount: number;
  sensitivity: 'low' | 'normal' | 'high';
  restrictedAfterHours: boolean;
  linkedCameraIds: string[];
  capacityWarning?: number;
  capacityCritical?: number;
};

export type ZoneOccupancySnapshot = {
  zoneId: string;
  zoneName: string;
  zoneType: string;
  currentCount: number;
  capacity: number;
  percentFull: number;
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
};

export type SchoolIncidentType =
  | 'after_hours_intrusion' | 'fall_detected' | 'loitering'
  | 'crowd_threshold' | 'restricted_zone' | 'perimeter' | 'other';

export type SchoolIncidentRow = {
  id: string;
  type: SchoolIncidentType;
  zone: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'resolved';
  createdAt: string;
  sla: 'on-track' | 'breached';
  occurredDuringSchoolHours: boolean;
};

export type SchoolRawMetrics = {
  intrusionAlerts: number;
  perimeterAlerts: number;
  avgAcknowledgeMinutes: number;
  avgResolutionMinutes: number;
  slaBreaches: number;
  totalCameras: number;
  onlineCameras: number;
  streamDropCount: number;
  afterHoursViolations: number;
  activeAlerts: number;
  openIncidents: number;
};

export type SchoolScoreResult = {
  campusSafetyScore: number;
  physicalSecurityScore: number;
  responseScore: number;
  complianceScore: number;
  cameraHealthScore: number;
};

export type OverviewKPIs = {
  safetyScore: number | null;
  activeAlerts: number | null;
  openIncidents: number | null;
  camerasOnline: string | null;
  afterHoursViolations: number | null;
  avgResponseMinutes: number | null;
  dataSource: 'api' | 'empty';
};
export type AlertTrendPoint = {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
};

export type RiskZoneRow = {
  zoneId: string;
  name: string;
  zoneType: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  alertCount: number;
  insight: string;
};

export type SIRecommendation = {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  body: string;
};

export type CampusSafetyPayload = {
  scores: SchoolScoreResult;
  metrics: SchoolRawMetrics;
  alertTrend: AlertTrendPoint[];
  topRiskZones: RiskZoneRow[];
  summary: string;
  recommendations: SIRecommendation[];
};

export type OccupancyPayload = {
  snapshots: ZoneOccupancySnapshot[];
  assemblyMode: boolean;
  thresholdAlerts: { zoneName: string; level: 'warning' | 'critical'; percentFull: number }[];
  busyZones: { zoneName: string; currentCount: number; capacity: number }[];
  trend: { hour: string; count: number }[];
};

export type IncidentsPayload = {
  rows: SchoolIncidentRow[];
  byType: { type: string; count: number }[];
  avgResponseMinutes: number;
  slaBreachRate: number;
};

export type DigestSection = {
  id: string;
  title: string;
  bullets: string[];
};

export type DigestPayload = {
  generatedAt: string;
  schoolName: string;
  sections: DigestSection[];
};
