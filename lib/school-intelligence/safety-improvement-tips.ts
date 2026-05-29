type SafetyEventLike = {
  eventType: string;
  severity: string;
  evidence?: { summary?: string };
};

const EVENT_INSIGHTS: Record<string, string> = {
  FallDetected: 'Repeated fall detections near stairwells may indicate a coverage or lighting gap worth reviewing on site.',
  FireSmokeDetected: 'Smoke signatures in lab corridors should be correlated with facilities logs and HVAC activity.',
  FireExitObstruction: 'Obstruction patterns at fire exits often cluster around delivery windows — worth a physical walk-through.',
  EmergencyExitCrowding: 'Exit crowding during dismissal suggests flow management could be smoothed at peak minutes.',
  CriticalCameraOffline: 'Offline gate cameras reduce visibility for perimeter observations during busy arrival windows.',
  RestrictedZoneEntry: 'After-hours restricted-zone activity is elevated — align with access-control records when available.',
  ServerRoomEntry: 'Server room entries outside staffed hours are worth noting for IT access policy review.',
  Loitering: 'Extended dwell times at the bus bay may reflect pickup congestion rather than a single incident.',
  RunningDetected: 'Corridor running detections peak during class transitions — consider zone sensitivity at bell times.',
  VehicleStudentOverlap: 'Vehicle–pedestrian overlap near pickup lanes is a recurring pattern in afternoon windows.',
  UnsafeClimbing: 'Playground climbing activity outside permitted hours appears in late-afternoon observations.',
};

const SCORE_BAND_INSIGHTS: { max: number; tips: string[] }[] = [
  {
    max: 55,
    tips: [
      'Critical observation volume is weighing on the safety score — focus review on stairwells, exits, and gates first.',
      'Camera coverage gaps amplify blind spots; compare offline feeds with zones that generated the most detections.',
    ],
  },
  {
    max: 70,
    tips: [
      'Medium-severity observations are adding up — look for repeat zones across the selected period.',
      'Tightening rule thresholds in low-risk periods may reduce noise without losing important signals.',
    ],
  },
  {
    max: 85,
    tips: [
      'Observation mix is manageable — continue monitoring high-traffic zones during arrival and dismissal.',
      'Stable scores often depend on consistent camera health at gates and playgrounds.',
    ],
  },
  {
    max: 101,
    tips: [
      'Scores are strong for this period — use the feed to spot early drift before patterns worsen.',
    ],
  },
];

function humanizeEventType(type: string): string {
  return type.replace(/([A-Z])/g, ' $1').trim();
}

/** Observational insights to contextualize the safety score (not operational close-out tasks). */
export function buildSafetyImprovementTips(
  score: number | null,
  events: SafetyEventLike[],
  minCount = 4,
): string[] {
  const tips: string[] = [];
  const push = (text: string) => {
    const t = text.trim();
    if (!t || tips.includes(t)) return;
    tips.push(t);
  };

  const priority = events.filter((e) => e.severity === 'Critical' || e.severity === 'High');

  for (const e of priority.slice(0, 3)) {
    const insight =
      EVENT_INSIGHTS[e.eventType] ??
      `${humanizeEventType(e.eventType)} is appearing in recent observations — review camera context for that zone.`;
    push(insight);
    if (tips.length >= minCount) return tips.slice(0, minCount);
  }

  if (events.length > 0) {
    push(
      `${events.length} safety observation${events.length === 1 ? '' : 's'} recorded in this period — patterns below are for awareness, not ticket closure.`,
    );
  }

  const band = SCORE_BAND_INSIGHTS.find((b) => (score ?? 0) < b.max);
  for (const line of band?.tips ?? SCORE_BAND_INSIGHTS[0].tips) {
    push(line);
    if (tips.length >= minCount) break;
  }

  return tips.slice(0, minCount);
}
