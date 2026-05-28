
import type { IncidentsPayload, SchoolIncidentRow } from './types';

export const DEMO_INCIDENTS: SchoolIncidentRow[] = [
  {
    id: 'INC-2401',
    type: 'after_hours_intrusion',
    zone: 'Main Gate',
    severity: 'high',
    status: 'investigating',
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
    sla: 'on-track',
    occurredDuringSchoolHours: false,
  },
  {
    id: 'INC-2402',
    type: 'crowd_threshold',
    zone: 'Playground',
    severity: 'medium',
    status: 'open',
    createdAt: new Date(Date.now() - 7200_000).toISOString(),
    sla: 'on-track',
    occurredDuringSchoolHours: true,
  },
  {
    id: 'INC-2403',
    type: 'restricted_zone',
    zone: 'Block A Corridor',
    severity: 'critical',
    status: 'open',
    createdAt: new Date(Date.now() - 1800_000).toISOString(),
    sla: 'breached',
    occurredDuringSchoolHours: true,
  },
];

export function buildDemoIncidents(): IncidentsPayload {
  const byTypeMap: Record<string, number> = {};
  for (const r of DEMO_INCIDENTS) byTypeMap[r.type] = (byTypeMap[r.type] ?? 0) + 1;
  return {
    rows: DEMO_INCIDENTS,
    byType: Object.entries(byTypeMap).map(([type, count]) => ({ type, count })),
    avgResponseMinutes: 14.5,
    slaBreachRate: 12,
  };
}
