'use client';

import { useState } from 'react';
import { Video, Wifi, WifiOff, AlertTriangle, Server } from 'lucide-react';
import { BIFilterBar, type BIFilters } from '@/components/business-intelligence/BIFilterBar';
import { BICameraHealthCard } from '@/components/business-intelligence/BICameraHealthCard';
import { BIRecommendationCard } from '@/components/business-intelligence/BIRecommendationCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { generateRecommendations } from '@/lib/business-intelligence/recommendation-engine';
import { DEMO_SCORES } from '@/lib/business-intelligence/score-calculator';
import { useQuery } from '@tanstack/react-query';

const DEMO_CAMERAS = [
  { id: 'CAM-HAN-014', name: 'Parking Cam 4', area: 'Parking Area', status: 'online', streamDrops: 28, health: 'Degraded' },
  { id: 'CAM-HAN-007', name: 'Main Gate Left', area: 'Main Gate', status: 'offline', streamDrops: 0, health: 'Offline' },
  { id: 'CAM-HAN-002', name: 'Warehouse Entry', area: 'Warehouse', status: 'online', streamDrops: 4, health: 'Good' },
  { id: 'CAM-HAN-019', name: 'Reception Cam', area: 'Reception', status: 'online', streamDrops: 1, health: 'Good' },
];

const DEMO_EDGE = [
  { id: 'EDGE-HAN-01', name: 'Hannur Edge Node 1', status: 'online', uptime: 99.8, cameras: 12 },
  { id: 'EDGE-HAN-02', name: 'Hannur Edge Node 2', status: 'degraded', uptime: 94.2, cameras: 12 },
];

const DEMO_METRICS = {
  totalAlerts: 85, criticalAlerts: 8, repeatedAlerts: 31, unacknowledgedAlerts: 5,
  avgAcknowledgeMinutes: 7.4, avgResolutionMinutes: 142, slaBreaches: 4, autoClosed: 14,
  totalCameras: 24, onlineCameras: 22, streamDropCount: 33, offlineCriticalCameras: 1,
  edgeServerUptime: 97, openIncidents: 12, unresolvedIncidentCount: 4,
  avgIncidentAgeDays: 2.1, criticalAreaAlerts: 18,
};

export default function CameraHealthIntelligencePage() {
  const [filters, setFilters] = useState<BIFilters>({ organizationId: '', siteId: '', dateRange: '7d' });

  const { data, isLoading } = useQuery({
    queryKey: ['bi-camera-health', filters],
    queryFn: async () => {
      const res = await fetch(`/api/business-intelligence/camera-health?dateRange=${filters.dateRange}`);
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  const cameras = data?.cameras ?? DEMO_CAMERAS;
  const edgeNodes = data?.edgeNodes ?? DEMO_EDGE;
  const recs = generateRecommendations(DEMO_SCORES, DEMO_METRICS).filter(
    (r) => r.category === 'Camera Maintenance'
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-100">
          <Video className="h-7 w-7 text-blue-400" /> Camera Health Intelligence
        </h1>
        <p className="text-sm text-slate-400">Camera reliability view — offline cameras, stream drops, edge health, and maintenance recommendations.</p>
      </div>

      <BIFilterBar filters={filters} onChange={setFilters} />

      {/* Top cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Cameras', value: DEMO_METRICS.totalCameras, icon: Video, color: 'text-blue-400' },
          { label: 'Online', value: DEMO_METRICS.onlineCameras, icon: Wifi, color: 'text-green-400' },
          { label: 'Stream Drops', value: DEMO_METRICS.streamDropCount, icon: AlertTriangle, color: 'text-yellow-400' },
          { label: 'Critical Offline', value: DEMO_METRICS.offlineCriticalCameras, icon: WifiOff, color: 'text-red-400' },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.label} className="border-slate-800 bg-slate-900">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">{m.label}</p>
                  <Icon className={`h-4 w-4 ${m.color}`} />
                </div>
                <p className={`mt-2 text-3xl font-bold ${m.color}`}>{m.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Camera list */}
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-100">Camera Risk Ranking</CardTitle>
              <p className="text-xs text-slate-500">Cameras with repeated issues or critical offline status</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                      <th className="pb-2 pr-4">Camera ID</th>
                      <th className="pb-2 pr-4">Area</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Stream Drops</th>
                      <th className="pb-2">Health</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cameras.map((c: typeof DEMO_CAMERAS[0]) => (
                      <tr key={c.id} className="border-b border-slate-800/50">
                        <td className="py-2.5 pr-4 font-medium text-slate-200">{c.id}</td>
                        <td className="py-2.5 pr-4 text-slate-400">{c.area}</td>
                        <td className="py-2.5 pr-4">
                          <Badge variant={c.status === 'online' ? 'success' : 'destructive'}>{c.status}</Badge>
                        </td>
                        <td className="py-2.5 pr-4 text-slate-400">{c.streamDrops}</td>
                        <td className="py-2.5">
                          <span className={c.health === 'Good' ? 'text-green-400' : c.health === 'Degraded' ? 'text-yellow-400' : 'text-red-400'}>
                            {c.health}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* AI insight example */}
          <Card className="border-slate-800 bg-blue-950/20">
            <CardContent className="p-4 text-sm text-slate-300">
              <p className="font-medium text-blue-400 mb-1">AI Camera Insight</p>
              Camera CAM-HAN-014 has dropped frames 28 times in the last 24 hours. This may affect evidence reliability for alerts in the parking area. Check network cable, switch port, or stream profile.
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <BICameraHealthCard data={data?.cameraSummary} isLoading={isLoading} />

          {/* Edge server health */}
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
                <Server className="h-4 w-4 text-blue-400" /> Edge Server Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {edgeNodes.map((node: typeof DEMO_EDGE[0]) => (
                  <div key={node.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-200">{node.name}</span>
                      <Badge variant={node.status === 'online' ? 'success' : 'warning'}>{node.status}</Badge>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Uptime: {node.uptime}%</span>
                      <span>{node.cameras} cameras</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div className={`h-full rounded-full ${node.uptime >= 99 ? 'bg-green-500' : node.uptime >= 95 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${node.uptime}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Maintenance recommendations */}
      {recs.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Maintenance Recommendations</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {recs.map((rec) => <BIRecommendationCard key={rec.id} rec={rec} />)}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-slate-600">
        No live intelligence data available yet. Once camera health and incidents are synced, Orion Alerts will calculate camera health insights.
      </p>
    </div>
  );
}
