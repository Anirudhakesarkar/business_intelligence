import type { SetupHealth, SetupNextAction } from './types';

export type SetupHealthPgMetrics = {
  activeCameras: number;
  mappedActiveCameras: number;
  orgRooms: number;
  roomsWithCapacity: number;
  activeTimetable: number;
  activeRosters: number;
  calendarDays: number;
};

const CORE_MISSING_PREFIXES = [
  'Register at least one active camera',
  'Map all active cameras',
  'Configure rooms with capacity',
  'Set capacity on all rooms',
  'Add timetable entries',
  'Add staff duty roster entries',
  'Add at least 30 calendar days',
] as const;

export function isCoreSetupMissingMessage(message: string): boolean {
  return CORE_MISSING_PREFIXES.some((p) => message.startsWith(p) || message === p);
}

export function buildCoreMissingFromCounts(c: SetupHealthPgMetrics): string[] {
  const missing: string[] = [];
  if (c.activeCameras === 0) missing.push('Register at least one active camera');
  if (c.mappedActiveCameras < c.activeCameras) missing.push('Map all active cameras to zone or room');
  if (c.orgRooms === 0) missing.push('Configure rooms with capacity');
  if (c.orgRooms > 0 && c.roomsWithCapacity < c.orgRooms) missing.push('Set capacity on all rooms');
  if (c.activeTimetable === 0) missing.push('Add timetable entries');
  if (c.activeRosters === 0) missing.push('Add staff duty roster entries');
  if (c.calendarDays < 30) missing.push('Add at least 30 calendar days');
  return missing;
}

export function getNextSetupActionFromCounts(c: SetupHealthPgMetrics): SetupNextAction | null {
  if (c.activeCameras === 0) {
    return {
      label: 'Register cameras',
      href: '/dashboard/school-management/cameras',
      reason: 'Add at least one active camera to begin mapping.',
    };
  }
  if (c.mappedActiveCameras < c.activeCameras) {
    return {
      label: 'Map cameras to locations',
      href: '/dashboard/school-management/cameras',
      reason: `${c.activeCameras - c.mappedActiveCameras} active camera(s) still need zone or room mapping.`,
    };
  }
  if (c.orgRooms === 0 || c.roomsWithCapacity < c.orgRooms) {
    return {
      label: 'Configure rooms',
      href: '/dashboard/school-management/master-data',
      reason: 'Set room capacity and hierarchy before timetable and occupancy modules.',
    };
  }
  if (c.activeTimetable === 0) {
    return {
      label: 'Build timetable',
      href: '/dashboard/school-management/timetable',
      reason: 'Timetable entries link classes, teachers, and rooms for intelligence modules.',
    };
  }
  if (c.activeRosters === 0) {
    return {
      label: 'Assign duty roster',
      href: '/dashboard/school-management/staff-duty',
      reason: 'Staff duty roster covers gate and corridor supervision windows.',
    };
  }
  if (c.calendarDays < 30) {
    return {
      label: 'Complete school calendar',
      href: '/dashboard/school-management/calendar',
      reason: 'Add at least 30 calendar days including holidays and exam periods.',
    };
  }
  return null;
}

/** Six core readiness checks (same weights as getSetupHealth in store). */
export function computeCoreChecks(c: SetupHealthPgMetrics): boolean[] {
  return [
    c.activeCameras > 0,
    c.activeCameras > 0 && c.mappedActiveCameras === c.activeCameras,
    c.orgRooms > 0 && c.roomsWithCapacity === c.orgRooms,
    c.activeTimetable > 0,
    c.activeRosters > 0,
    c.calendarDays >= 30,
  ];
}

/** Recompute percent, next action, and core missing from Postgres-aligned counts. */
export function applyPgMetricsToSetupHealth(health: SetupHealth, pg: SetupHealthPgMetrics): SetupHealth {
  const checks = computeCoreChecks(pg);
  const checksPercent = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const coreMissing = buildCoreMissingFromCounts(pg);
  const extendedMissing = health.missing.filter((m) => !isCoreSetupMissingMessage(m));
  const dedupedMissing = [...new Set([...coreMissing, ...extendedMissing])];
  const isReadyForPhase2 = checks.every(Boolean) && dedupedMissing.length === 0;
  const completionPercent = isReadyForPhase2
    ? 100
    : dedupedMissing.length > 0
      ? Math.min(checksPercent, 99)
      : checksPercent;
  const nextAction = getNextSetupActionFromCounts(pg) ?? health.nextAction;

  return {
    ...health,
    completionPercent,
    isReadyForPhase2,
    missing: dedupedMissing,
    nextAction,
    camerasMapped: { complete: pg.mappedActiveCameras, total: pg.activeCameras },
    roomsConfigured: { complete: pg.roomsWithCapacity, total: pg.orgRooms },
    timetableEntries: pg.activeTimetable,
    rosterEntries: pg.activeRosters,
    calendarDays: pg.calendarDays,
  };
}
