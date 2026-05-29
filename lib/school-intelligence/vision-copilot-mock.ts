export type VisionCamera = {
  id: string;
  name: string;
  zone: string;
  status: 'online' | 'degraded' | 'offline';
  risk: 'low' | 'medium' | 'high';
  lastEvent: string;
  confidence: number;
};

export type VisionEvent = {
  id: string;
  time: string;
  title: string;
  camera: string;
  severity: 'critical' | 'watch' | 'info' | 'resolved';
};

export type VisionAction = {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  owner: string;
};

export type VisionViewMode = 'site-overview' | 'camera-focus' | 'incident-review';

export const VISION_CAMERAS: VisionCamera[] = [
  { id: 'main-gate', name: 'Main Gate - North Entry', zone: 'Perimeter', status: 'online', risk: 'medium', lastEvent: '5:35 PM', confidence: 94 },
  { id: 'parking-east', name: 'Parking East', zone: 'Parking', status: 'degraded', risk: 'medium', lastEvent: '5:22 PM', confidence: 81 },
  { id: 'back-corridor', name: 'Back Corridor', zone: 'Interior', status: 'online', risk: 'high', lastEvent: '4:48 PM', confidence: 88 },
  { id: 'lobby', name: 'Lobby', zone: 'Reception', status: 'online', risk: 'low', lastEvent: '4:15 PM', confidence: 96 },
  { id: 'playground', name: 'Playground', zone: 'Outdoor', status: 'online', risk: 'low', lastEvent: '3:50 PM', confidence: 92 },
  { id: 'server-room', name: 'Server Room', zone: 'Restricted', status: 'offline', risk: 'high', lastEvent: '2:10 PM', confidence: 0 },
];

export const VISION_EVENTS: VisionEvent[] = [
  { id: 'e1', time: '5:35 PM', title: 'Queue threshold crossed', camera: 'Main Gate - North Entry', severity: 'watch' },
  { id: 'e2', time: '5:22 PM', title: 'Camera stream recovered', camera: 'Parking East', severity: 'resolved' },
  { id: 'e3', time: '5:10 PM', title: 'Vehicle dwell detected', camera: 'Main Gate - North Entry', severity: 'watch' },
  { id: 'e4', time: '4:48 PM', title: 'Restricted zone motion', camera: 'Back Corridor', severity: 'critical' },
  { id: 'e5', time: '4:30 PM', title: 'Crowd density normal', camera: 'Lobby', severity: 'info' },
  { id: 'e6', time: '3:55 PM', title: 'Playground activity spike', camera: 'Playground', severity: 'info' },
];

export const VISION_ACTIONS: VisionAction[] = [
  { id: 'a1', title: 'Assign guard to Main Gate for dispersal', priority: 'high', owner: 'Ops Lead' },
  { id: 'a2', title: 'Review Parking East stream drops', priority: 'medium', owner: 'IT Support' },
  { id: 'a3', title: 'Escalate repeated restricted zone motion', priority: 'high', owner: 'Security' },
];

export const SUGGESTED_PROMPTS = [
  'What changed at Main Gate today?',
  'Which camera needs attention first?',
  'Why did risk increase after 5 PM?',
  'Summarize evidence for open incidents.',
  'Which area has repeated alerts?',
] as const;

export const CANNED_RESPONSE =
  'Main Gate shows a moderate queue pattern between 5:10 PM and 5:35 PM. Two repeated gate-hold events and one vehicle dwell event increased operational risk. Recommended action: assign one guard to the north entry during dispersal.';

export const SCENE_DETECTIONS = [
  'Queue forming',
  'Vehicle at gate',
  'Crowd density: Normal',
] as const;
