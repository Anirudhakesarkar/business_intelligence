
import type { OccupancyPayload, ZoneOccupancySnapshot } from './types';
import { DEMO_ZONES } from './zones-demo';

export function buildDemoOccupancy(): OccupancyPayload {
  const snapshots: ZoneOccupancySnapshot[] = DEMO_ZONES.map((z, i) => {
    const capacity = z.capacityCritical ?? 100;
    const currentCount = [42, 18, 95, 12][i] ?? 20;
    const percentFull = Math.round((currentCount / capacity) * 100);
    return {
      zoneId: z.id,
      zoneName: z.name,
      zoneType: z.zoneType,
      currentCount,
      capacity,
      percentFull,
      trend: (['up', 'stable', 'down', 'stable'] as const)[i] ?? 'stable',
      lastUpdated: new Date().toISOString(),
    };
  });
  return {
    snapshots,
    assemblyMode: false,
    thresholdAlerts: [
      { zoneName: 'Playground', level: 'warning', percentFull: 48 },
      { zoneName: 'Main Gate', level: 'critical', percentFull: 88 },
    ],
    busyZones: snapshots
      .slice()
      .sort((a, b) => b.percentFull - a.percentFull)
      .slice(0, 3)
      .map((s) => ({ zoneName: s.zoneName, currentCount: s.currentCount, capacity: s.capacity })),
    trend: ['08:00', '10:00', '12:00', '14:00', '16:00'].map((hour, idx) => ({
      hour,
      count: 120 + idx * 35,
    })),
  };
}
