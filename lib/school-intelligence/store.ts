
import type {
  CampusSafetyPayload,
  IncidentsPayload,
  OccupancyPayload,
  OverviewKPIs,
  SchoolZone,
  SiteBellSchedule,
  SIFilters,
} from './types';
import { defaultBellSchedule } from './bell-schedule';
import { buildDemoIncidents, DEMO_INCIDENTS } from './incidents';
import { buildDemoOccupancy } from './occupancy';
import { calculateSchoolScores, DEMO_METRICS } from './safety-scores';
import { buildOverviewSummary } from './summary-templates';
import { DEMO_ZONES } from './zones-demo';

const bellBySite: Record<string, SiteBellSchedule> = {
  'site-main': defaultBellSchedule('site-main'),
  'site-annex': defaultBellSchedule('site-annex'),
};

let assemblyMode = false;

export function getBellSchedule(siteId: string): SiteBellSchedule {
  return bellBySite[siteId] ?? defaultBellSchedule(siteId || 'site-main');
}

export function setBellSchedule(schedule: SiteBellSchedule): SiteBellSchedule {
  bellBySite[schedule.siteId] = schedule;
  return schedule;
}

export function setAssemblyMode(enabled: boolean) {
  assemblyMode = enabled;
}

export async function getOverview(filters: SIFilters) {
  const scores = calculateSchoolScores(DEMO_METRICS);
  const kpis: OverviewKPIs = {
    safetyScore: scores.campusSafetyScore,
    activeAlerts: DEMO_METRICS.activeAlerts,
    openIncidents: DEMO_METRICS.openIncidents,
    camerasOnline: `${DEMO_METRICS.onlineCameras}/${DEMO_METRICS.totalCameras}`,
    afterHoursViolations: DEMO_METRICS.afterHoursViolations,
    avgResponseMinutes: DEMO_METRICS.avgAcknowledgeMinutes,
    dataSource: 'api',
  };
  return {
    filters,
    kpis,
    scores,
    summary: buildOverviewSummary(scores),
    topRiskZones: [
      {
        zoneId: 'z-main-gate',
        name: 'Main Gate',
        zoneType: 'entrance',
        riskLevel: 'High' as const,
        alertCount: 18,
        insight: 'Repeated after-hours motion (demo label).',
      },
      {
        zoneId: 'z-playground',
        name: 'Playground',
        zoneType: 'playground',
        riskLevel: 'Medium' as const,
        alertCount: 9,
        insight: 'Crowd threshold during lunch (demo label).',
      },
    ],
    alertTrend: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400000);
      return {
        date: d.toISOString().slice(0, 10),
        critical: 1 + (i % 3),
        high: 3 + (i % 2),
        medium: 5,
        low: 2,
      };
    }),
    recommendations: [
      {
        id: 'rec-1',
        title: 'Tighten after-hours rules at Main Gate',
        priority: 'high' as const,
        body: 'Demo recommendation — align alert rules with bell schedule.',
      },
    ],
  };
}

export async function getCampusSafety(filters: SIFilters): Promise<CampusSafetyPayload> {
  const scores = calculateSchoolScores(DEMO_METRICS);
  const overview = await getOverview(filters);
  return {
    scores,
    metrics: DEMO_METRICS,
    alertTrend: overview.alertTrend,
    topRiskZones: overview.topRiskZones,
    summary: overview.summary,
    recommendations: overview.recommendations,
  };
}

export async function getZones(_filters: SIFilters): Promise<{ zones: SchoolZone[]; schedule: SiteBellSchedule }> {
  const siteId = _filters.siteId || 'site-main';
  return { zones: DEMO_ZONES, schedule: getBellSchedule(siteId) };
}

export async function getOccupancy(_filters: SIFilters): Promise<OccupancyPayload> {
  const data = buildDemoOccupancy();
  return { ...data, assemblyMode };
}

export async function getIncidents(_filters: SIFilters): Promise<IncidentsPayload> {
  return buildDemoIncidents();
}

export { DEMO_INCIDENTS, DEMO_ZONES, DEMO_METRICS };
