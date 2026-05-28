export type TopologyCadLayout = {
  id: string;
  organizationId: string;
  siteId: string;
  floorId: string | null;
  cadName: string;
  originalFileName: string;
  fileType: string;
  fileUrl: string;
  previewImageUrl: string | null;
  storageProvider: string;
  fileSizeBytes: number | null;
  drawingUnits: string | null;
  drawingWidth: number | null;
  drawingHeight: number | null;
  minX: number | null;
  minY: number | null;
  maxX: number | null;
  maxY: number | null;
  scaleRatio: number | null;
  scaleUnit: string | null;
  isActive: boolean;
  parseStatus: string;
  parseError: string | null;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type TopologyCadLayer = {
  id: string;
  organizationId: string;
  siteId: string;
  cadLayoutId: string;
  layerName: string;
  layerColor: string | null;
  entityCount: number;
  isVisible: boolean;
  isLocked: boolean;
  layerType: string | null;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type TopologyLayout = {
  id: string;
  organizationId: string;
  siteId: string;
  floorId: string | null;
  layoutName: string;
  originalFileName: string;
  fileType: string;
  fileUrl: string;
  previewImageUrl: string | null;
  storageProvider: string;
  fileSizeBytes: number | null;
  pageNumber: number | null;
  widthPx: number | null;
  heightPx: number | null;
  scaleRatio: number | null;
  scaleUnit: string | null;
  isActive: boolean;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type TopologyDevice = {
  id: string;
  organizationId: string;
  siteId: string;
  floorId: string | null;
  deviceType: string;
  displayName: string;
  hostname: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  vlan: string | null;
  subnet: string | null;
  gateway: string | null;
  locationLabel: string | null;
  rackName: string | null;
  portNumber: string | null;
  parentDeviceId: string | null;
  status: string;
  poeEnabled: boolean;
  poeWattage: number | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  notes: string | null;
  positionX: number;
  positionY: number;
  positionZ: number;
  metadataJson: Record<string, unknown> | null;
  layoutId: string | null;
  layoutPositionX: number | null;
  layoutPositionY: number | null;
  layoutRotation: number | null;
  layoutScale: number | null;
  cadLayoutId: string | null;
  cadPositionX: number | null;
  cadPositionY: number | null;
  cadRotation: number | null;
  cadScale: number | null;
  monitoringEnabled?: boolean;
  monitoringIp?: string | null;
  monitoringPort?: number | null;
  monitoringProtocol?: string | null;
  snmpEnabled?: boolean;
  snmpVersion?: string | null;
  snmpCommunityRef?: string | null;
  healthStatus?: string | null;
  lastSeenAt?: string | null;
  lastCheckedAt?: string | null;
  /** Merged from devicesHealth for visuals */
  healthScore?: number | null;
  latencyMs?: number | null;
  poeBudgetWatts?: number | null;
  poeUsedWatts?: number | null;
  poeAvailableWatts?: number | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TopologyConnection = {
  id: string;
  organizationId: string;
  siteId: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  cableType: string;
  portFrom: string | null;
  portTo: string | null;
  bandwidthLabel: string | null;
  vlanLabel: string | null;
  status: string;
  notes: string | null;
  metadataJson: Record<string, unknown> | null;
  layoutId: string | null;
  pathPointsJson: unknown | null;
  cadLayoutId: string | null;
  cadPathPointsJson: unknown | null;
  deletedAt?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TopologySummary = {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  warningDevices: number;
  poeSwitches: number;
  accessPoints: number;
  cameras: number;
  networkHealthScore: number;
};

export type TopologyHealthSummaryApi = {
  monitoringEnabled: boolean;
  networkHealthScore: number | null;
  avgLatencyMs: number | null;
  monitoredDeviceCount: number;
  onlineCount: number;
  offlineCount: number;
  warningCount: number;
};

export type TopologyDeviceHealth = {
  id: string;
  organizationId: string;
  siteId: string;
  deviceId: string;
  ipAddress: string;
  currentStatus: string;
  lastSeenAt: string | null;
  lastCheckedAt: string | null;
  latencyMs: number | null;
  packetLossPercent: number | null;
  healthScore: number;
  errorMessage: string | null;
};

export type TopologyHealthFailure = {
  deviceId: string;
  displayName: string;
  ipAddress: string;
  status: string;
  error: string | null;
  checkedAt: string;
};



export type TopologyDiscoveryJobSummary = {
  id: string;
  organizationId: string;
  siteId: string;
  jobName: string;
  scanRange: string;
  scanType: string;
  status: string;
  totalTargets: number;
  scannedTargets: number;
  discoveredCount: number;
  matchedCount: number;
  suggestionCount: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export type TopologyPayload = {
  ok?: boolean;
  summary: TopologySummary;
  devices: TopologyDevice[];
  connections: TopologyConnection[];
  view: {
    id: string;
    cameraPositionJson: Record<string, unknown>;
    cameraTargetJson: Record<string, unknown>;
    zoomLevel: number | null;
  } | null;
  layouts?: TopologyLayout[];
  activeLayout?: TopologyLayout | null;
  cadLayouts?: TopologyCadLayout[];
  activeCadLayout?: TopologyCadLayout | null;
  cadLayers?: TopologyCadLayer[];
  healthSummary?: TopologyHealthSummaryApi;
  devicesHealth?: TopologyDeviceHealth[];
  recentFailures?: TopologyHealthFailure[];
  healthTrend?: unknown[];
  /** Phase 5 discovery summary */
  latestDiscoveryJob?: TopologyDiscoveryJobSummary | null;
  pendingSuggestionsCount?: number;
  discoveredUnmatchedCount?: number;
};
