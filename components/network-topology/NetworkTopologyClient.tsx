/* eslint-disable @typescript-eslint/no-misused-promises */
'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getConfig, setConfig } from '@/app/lib/config';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet } from '@/components/ui/sheet';
import { TopologyScene } from './TopologyScene';
import { TopologyLayoutCanvas, uploadFloorPlan } from './TopologyLayoutCanvas';
import { TopologyCadCanvas, uploadCadDxf } from './TopologyCadCanvas';
import type { TopologyDevice, TopologyConnection, TopologyPayload } from './types';
import {
  Network,
  Plus,
  Link2,
  Save,
  RotateCcw,
  Maximize2,
  Type,
  Sparkles,
  Grid3x3,
  LayoutTemplate,
  ImageOff,
} from 'lucide-react';

const PALETTE: { type: string; label: string; desc: string }[] = [
  { type: 'internet', label: 'Internet', desc: 'WAN entry' },
  { type: 'router', label: 'Router', desc: 'Gateway / firewall' },
  { type: 'firewall', label: 'Firewall', desc: 'Security appliance' },
  { type: 'core_switch', label: 'Core Switch', desc: 'Distribution' },
  { type: 'poe_switch', label: 'PoE Switch', desc: 'Powers APs & cameras' },
  { type: 'access_point_indoor', label: 'Indoor AP', desc: 'Indoor Wi-Fi' },
  { type: 'access_point_outdoor', label: 'Outdoor AP', desc: 'Outdoor Wi-Fi' },
  { type: 'camera', label: 'IP Camera', desc: 'CCTV' },
  { type: 'nvr', label: 'NVR', desc: 'Recorder' },
  { type: 'edge_ai', label: 'Edge AI', desc: 'On-site inference' },
  { type: 'server', label: 'Server', desc: 'App / storage' },
  { type: 'workstation', label: 'Workstation', desc: 'Operator client' },
  { type: 'unknown', label: 'Unknown', desc: 'Unclassified device' },
];

const VIEW_MODES = [
  '3D Topology',
  'Site Layout',
  'CAD Layout',
  'Logical Map',
  'Device Health',
  'PoE Load',
  'Bandwidth Flow',
  'Network Discovery',
] as const;

function parentName(devices: TopologyDevice[], id: string | null) {
  if (!id) return '—';
  return devices.find((d) => d.id === id)?.displayName ?? '—';
}

function connectedCount(deviceId: string, connections: TopologyConnection[]) {
  return connections.filter((c) => c.sourceDeviceId === deviceId || c.targetDeviceId === deviceId).length;
}

/** Sum PoE draw from linked devices (graph edges), per readme Phase 4. */
function poeDrawnWatts(switchId: string, allDevices: TopologyDevice[], conns: TopologyConnection[]) {
  const linked = new Set<string>();
  for (const c of conns) {
    if (c.sourceDeviceId === switchId) linked.add(c.targetDeviceId);
    if (c.targetDeviceId === switchId) linked.add(c.sourceDeviceId);
  }
  let sum = 0;
  for (const id of linked) {
    const d = allDevices.find((x) => x.id === id);
    if (d?.poeEnabled && d.poeWattage != null) sum += Number(d.poeWattage);
  }
  return sum;
}

export default function NetworkTopologyClient() {
  const queryClient = useQueryClient();
  const config = typeof window !== 'undefined' ? getConfig() : null;
  const orbitRef = useRef<any>(null);

  const [siteId, setSiteId] = useState(config?.siteId ?? '');
  const [viewMode, setViewMode] = useState<(typeof VIEW_MODES)[number]>('3D Topology');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConnId, setSelectedConnId] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [statusGlow, setStatusGlow] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [connDrawer, setConnDrawer] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [layoutPlaceType, setLayoutPlaceType] = useState<string | null>(null);
  const [layoutUploading, setLayoutUploading] = useState(false);
  const [showLayoutPaths, setShowLayoutPaths] = useState(true);
  const [selectedCadLayoutId, setSelectedCadLayoutId] = useState<string | null>(null);
  const [cadPlaceType, setCadPlaceType] = useState<string | null>(null);
  const [cadUploading, setCadUploading] = useState(false);
  const [showCadCablePaths, setShowCadCablePaths] = useState(true);
  const [discScanRange, setDiscScanRange] = useState('192.168.1.0/24');
  const [discJobName, setDiscJobName] = useState('Subnet scan');
  const [discScanType, setDiscScanType] = useState<'ping_tcp' | 'ping' | 'tcp'>('ping_tcp');

  const sitesQuery = useQuery({
    queryKey: ['sites-list', config?.token],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      return apiGet<{ sites: { site_id: string; name: string }[] }>(config, '/v1/dashboard/sites');
    },
    enabled: !!config,
  });

  useEffect(() => {
    if (siteId || !sitesQuery.data?.sites?.length) return;
    const first = sitesQuery.data.sites[0]?.site_id;
    if (first) setSiteId(first);
  }, [sitesQuery.data, siteId]);

  const topologyQuery = useQuery({
    queryKey: ['network-topology', siteId, config?.token],
    queryFn: async () => {
      if (!config) throw new Error('Not configured');
      const q = `/v1/infrastructure/network-topology?siteId=${encodeURIComponent(siteId)}`;
      return apiGet<TopologyPayload>(config, q);
    },
    enabled: !!config && !!siteId,
  });

  const devicesHealthList = topologyQuery.data?.devicesHealth ?? [];
  const healthSummaryApi = topologyQuery.data?.healthSummary;
  const recentFailuresList = topologyQuery.data?.recentFailures ?? [];

  const devices = useMemo(() => {
    const base = topologyQuery.data?.devices ?? [];
    const m = new Map(devicesHealthList.map((h) => [h.deviceId, h]));
    return base.map((d) => {
      const h = m.get(d.id);
      if (!h) return d;
      return {
        ...d,
        healthStatus: h.currentStatus ?? d.healthStatus,
        healthScore: h.healthScore,
        latencyMs: h.latencyMs,
        lastCheckedAt: h.lastCheckedAt,
      };
    });
  }, [topologyQuery.data?.devices, devicesHealthList]);

  const connections = topologyQuery.data?.connections ?? [];
  const summary = topologyQuery.data?.summary;
  const layouts = topologyQuery.data?.layouts ?? [];
  const activeLayoutApi = topologyQuery.data?.activeLayout ?? null;
  const cadLayouts = topologyQuery.data?.cadLayouts ?? [];
  const activeCadApi = topologyQuery.data?.activeCadLayout ?? null;
  const latestDiscoveryJob = topologyQuery.data?.latestDiscoveryJob;
  const pendingSuggestionsCount = topologyQuery.data?.pendingSuggestionsCount ?? 0;
  const discoveredUnmatchedCount = topologyQuery.data?.discoveredUnmatchedCount ?? 0;

  useEffect(() => {
    if (viewMode !== 'Network Discovery') return;
    const st = latestDiscoveryJob?.status;
    if (st !== 'pending' && st !== 'running') return;
    const id = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ['network-topology', siteId] });
    }, 3500);
    return () => window.clearInterval(id);
  }, [viewMode, latestDiscoveryJob?.status, siteId, queryClient]);

  const selectedLayout = useMemo(() => {
    if (!layouts.length) return activeLayoutApi ?? null;
    const pick = layouts.find((l) => l.id === selectedLayoutId);
    return pick ?? activeLayoutApi ?? layouts[0] ?? null;
  }, [layouts, selectedLayoutId, activeLayoutApi]);

  useEffect(() => {
    if (!layouts.length) {
      setSelectedLayoutId(null);
      return;
    }
    if (selectedLayoutId && layouts.some((l) => l.id === selectedLayoutId)) return;
    setSelectedLayoutId(activeLayoutApi?.id ?? layouts[0]?.id ?? null);
  }, [layouts, activeLayoutApi, selectedLayoutId]);

  const selectedCadLayout = useMemo(() => {
    if (!cadLayouts.length) return activeCadApi ?? null;
    const pick = cadLayouts.find((l) => l.id === selectedCadLayoutId);
    return pick ?? activeCadApi ?? cadLayouts[0] ?? null;
  }, [cadLayouts, selectedCadLayoutId, activeCadApi]);

  useEffect(() => {
    if (!cadLayouts.length) {
      setSelectedCadLayoutId(null);
      return;
    }
    if (selectedCadLayoutId && cadLayouts.some((l) => l.id === selectedCadLayoutId)) return;
    setSelectedCadLayoutId(activeCadApi?.id ?? cadLayouts[0]?.id ?? null);
  }, [cadLayouts, activeCadApi, selectedCadLayoutId]);

  const selected = useMemo(() => devices.find((d) => d.id === selectedId) ?? null, [devices, selectedId]);
  const selectedConn = useMemo(
    () => connections.find((c) => c.id === selectedConnId) ?? null,
    [connections, selectedConnId],
  );

  const updateDeviceMut = useMutation({
    mutationFn: async (patch: { id: string } & Partial<TopologyDevice>) => {
      if (!config) throw new Error('Not configured');
      const { id, ...rest } = patch;
      return apiPatch(config, `/v1/infrastructure/network-topology/devices/${id}`, rest);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['network-topology', siteId] });
    },
  });

  const createDeviceMut = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      if (!config) throw new Error('Not configured');
      return apiPost(config, '/v1/infrastructure/network-topology/devices', body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['network-topology', siteId] });
    },
  });

  const deleteDeviceMut = useMutation({
    mutationFn: async (id: string) => {
      if (!config) throw new Error('Not configured');
      return apiDelete(config, `/v1/infrastructure/network-topology/devices/${id}`);
    },
    onSuccess: () => {
      setSelectedId(null);
      setDrawerOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['network-topology', siteId] });
    },
  });

  const duplicateMut = useMutation({
    mutationFn: async (id: string) => {
      if (!config) throw new Error('Not configured');
      return apiPost(config, `/v1/infrastructure/network-topology/devices/${id}/duplicate`, {});
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['network-topology', siteId] });
    },
  });

  const runSiteHealthMut = useMutation({
    mutationFn: async () => {
      if (!config) throw new Error('Not configured');
      return apiPost(config, '/v1/infrastructure/network-topology/health/run', { siteId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['network-topology', siteId] });
      setSaveMsg('Health check completed');
      setTimeout(() => setSaveMsg(null), 2500);
    },
    onError: (e) => setSaveMsg(e instanceof Error ? e.message : 'Health run failed'),
  });

  const runDeviceHealthMut = useMutation({
    mutationFn: async (deviceId: string) => {
      if (!config) throw new Error('Not configured');
      return apiPost(config, `/v1/infrastructure/network-topology/devices/${deviceId}/health/run`, {});
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['network-topology', siteId] });
    },
  });

  const patchMonitoringMut = useMutation({
    mutationFn: async (args: {
      id: string;
      monitoringEnabled?: boolean;
      monitoringIp?: string | null;
      monitoringPort?: number | null;
      monitoringProtocol?: string | null;
    }) => {
      if (!config) throw new Error('Not configured');
      const { id, ...patch } = args;
      return apiPatch(config, `/v1/infrastructure/network-topology/devices/${id}/monitoring`, patch);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['network-topology', siteId] });
    },
  });

  const startDiscoveryMut = useMutation({
    mutationFn: async () => {
      if (!config) throw new Error('Not configured');
      return apiPost(config, '/v1/infrastructure/network-topology/discovery/jobs', {
        siteId,
        jobName: discJobName.trim() || 'Discovery scan',
        scanRange: discScanRange.trim(),
        scanType: discScanType,
        options: { timeoutMs: 3000, portScan: true },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['network-topology', siteId] });
      setSaveMsg('Discovery job queued — run the discovery worker to execute scans.');
      setTimeout(() => setSaveMsg(null), 4000);
    },
    onError: (e) => setSaveMsg(e instanceof Error ? e.message : 'Discovery failed'),
  });

  const generateDiscoverySuggestionsMut = useMutation({
    mutationFn: async (jobId: string) => {
      if (!config) throw new Error('Not configured');
      return apiPost(
        config,
        `/v1/infrastructure/network-topology/discovery/jobs/${jobId}/generate-suggestions`,
        {},
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['network-topology', siteId] });
    },
  });

  const createConnMut = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      if (!config) throw new Error('Not configured');
      return apiPost(config, '/v1/infrastructure/network-topology/connections', body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['network-topology', siteId] });
    },
  });

  const updateConnMut = useMutation({
    mutationFn: async (patch: { id: string } & Record<string, unknown>) => {
      if (!config) throw new Error('Not configured');
      const { id, ...rest } = patch;
      return apiPatch(config, `/v1/infrastructure/network-topology/connections/${id}`, rest);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['network-topology', siteId] });
    },
  });

  const saveViewMut = useMutation({
    mutationFn: async () => {
      if (!config) throw new Error('Not configured');
      const ctrl = orbitRef.current;
      const cam = ctrl?.object;
      if (!cam) throw new Error('Camera not ready');
      const pos = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
      const tgt = ctrl?.target ? { x: ctrl.target.x, y: ctrl.target.y, z: ctrl.target.z } : { x: 0, y: 0, z: 0 };
      return apiPost(config, '/v1/infrastructure/network-topology/view', {
        siteId,
        viewName: 'default',
        cameraPositionJson: pos,
        cameraTargetJson: tgt,
        zoomLevel: null,
      });
    },
    onSuccess: () => {
      setSaveMsg('View saved');
      setTimeout(() => setSaveMsg(null), 2500);
    },
  });

  const starterMut = useMutation({
    mutationFn: async (replace: boolean) => {
      if (!config) throw new Error('Not configured');
      return apiPost(config, '/v1/infrastructure/network-topology/starter-template', { siteId, replace });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['network-topology', siteId] });
    },
  });

  const autoLayoutMut = useMutation({
    mutationFn: async () => {
      if (!config) throw new Error('Not configured');
      return apiPost(config, '/v1/infrastructure/network-topology/auto-layout', { siteId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['network-topology', siteId] });
    },
  });

  const onPositionCommit = useCallback(
    (id: string, x: number, y: number, z: number) => {
      void updateDeviceMut.mutateAsync({ id, positionX: x, positionY: y, positionZ: z });
    },
    [updateDeviceMut],
  );

  const addPaletteDevice = async (deviceType: string) => {
    const n = devices.length;
    await createDeviceMut.mutateAsync({
      siteId,
      deviceType,
      displayName: PALETTE.find((p) => p.type === deviceType)?.label ?? deviceType,
      status: 'unknown',
      positionX: (n % 5) * 2.5 - 5,
      positionY: 1,
      positionZ: Math.floor(n / 5) * 2 - 2,
    });
    setDrawerOpen(true);
  };

  const onConnectPick = (id: string) => {
    if (!connectSourceId) {
      setConnectSourceId(id);
      return;
    }
    if (connectSourceId === id) {
      setConnectSourceId(null);
      return;
    }
    void (async () => {
      try {
        await createConnMut.mutateAsync({
          siteId,
          sourceDeviceId: connectSourceId,
          targetDeviceId: id,
          cableType: 'cat6',
          status: 'active',
        });
        setConnectMode(false);
        setConnectSourceId(null);
      } catch (e) {
        setSaveMsg(e instanceof Error ? e.message : 'Connection failed');
      }
    })();
  };

  const resetCamera = () => {
    const ctrl = orbitRef.current;
    if (!ctrl) return;
    ctrl.reset?.();
  };

  const fitCamera = () => {
    const ctrl = orbitRef.current;
    const cam = ctrl?.object;
    if (!cam || !devices.length) return;
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const d of devices) {
      minX = Math.min(minX, d.positionX);
      maxX = Math.max(maxX, d.positionX);
      minZ = Math.min(minZ, d.positionZ);
      maxZ = Math.max(maxZ, d.positionZ);
    }
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const span = Math.max(maxX - minX, maxZ - minZ, 8);
    cam.position.set(cx, span * 0.6 + 4, cz + span * 0.9);
    ctrl.target.set(cx, 0, cz);
    ctrl.update?.();
  };

  useEffect(() => {
    if (selectedId) setDrawerOpen(true);
    else setDrawerOpen(false);
  }, [selectedId]);

  if (!config) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-100">Network Topology</h1>
        <p className="text-slate-400">Configure server URL and sign in to use this page.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Network Topology</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Visualize, design, and manage your complete site network infrastructure in an interactive 3D topology
            view.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-500">Site</label>
          <select
            value={siteId}
            onChange={(e) => {
              const v = e.target.value;
              setSiteId(v);
              setConfig({ ...config, siteId: v });
            }}
            className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200"
          >
            {(sitesQuery.data?.sites ?? []).map((s) => (
              <option key={s.site_id} value={s.site_id}>
                {s.name} ({s.site_id})
              </option>
            ))}
          </select>
          <select
            disabled
            className="cursor-not-allowed rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-500"
          >
            <option>Floor (soon)</option>
          </select>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {VIEW_MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setViewMode(m)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              viewMode === m
                ? 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {m}
            {m !== '3D Topology' &&
              m !== 'Site Layout' &&
              m !== 'CAD Layout' &&
              m !== 'Logical Map' &&
              m !== 'Device Health' &&
              m !== 'PoE Load' &&
              m !== 'Network Discovery' && (
              <span className="ml-1 text-[10px] text-slate-500">(preview)</span>
            )}
          </button>
        ))}
      </div>

      {viewMode !== '3D Topology' &&
        viewMode !== 'Site Layout' &&
        viewMode !== 'CAD Layout' &&
        viewMode !== 'Device Health' &&
        viewMode !== 'PoE Load' &&
        viewMode !== 'Network Discovery' && (
        <Card className="border-slate-800 bg-slate-900/80">
          <CardContent className="py-6 text-center text-sm text-slate-400">
            <p>
              <strong className="text-slate-200">{viewMode}</strong> is prepared for a future release. Switch to{' '}
              <strong className="text-slate-200">3D Topology</strong> or <strong className="text-slate-200">Site Layout</strong>, or <strong className="text-slate-200">CAD Layout</strong>.
            </p>
          </CardContent>
        </Card>
      )}

      {topologyQuery.error && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="py-4 text-sm text-amber-100">
            {(topologyQuery.error as Error).message}
          </CardContent>
        </Card>
      )}

      {saveMsg && (
        <div className="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">
          {saveMsg}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        {[
          ['Total', summary?.totalDevices ?? 0],
          ['Online', healthSummaryApi?.onlineCount ?? summary?.onlineDevices ?? 0],
          ['Offline', healthSummaryApi?.offlineCount ?? summary?.offlineDevices ?? 0],
          ['Warning', healthSummaryApi?.warningCount ?? summary?.warningDevices ?? 0],
          ['Avg latency', healthSummaryApi?.avgLatencyMs != null ? `${healthSummaryApi.avgLatencyMs} ms` : '—'],
          ['PoE sw', summary?.poeSwitches ?? 0],
          ['APs', summary?.accessPoints ?? 0],
          [
            'Net health',
            healthSummaryApi?.networkHealthScore != null
              ? `${healthSummaryApi.networkHealthScore}`
              : summary
                ? `${summary.networkHealthScore}`
                : '—',
          ],
        ].map(([k, v]) => (
          <Card key={String(k)} className="border-slate-800 bg-slate-900">
            <CardContent className="p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">{k}</div>
              <div className="text-lg font-semibold text-slate-100">{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid min-h-[520px] flex-1 grid-cols-1 gap-3 lg:grid-cols-[220px_1fr]">
        {/* Palette */}
        <Card className="border-slate-800 bg-slate-900 lg:max-h-[720px] lg:overflow-y-auto">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
              <Network className="h-4 w-4 text-sky-400" />
              Asset palette
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {PALETTE.map((p) => (
              <div
                key={p.type}
                className="flex items-start justify-between gap-2 rounded-md border border-slate-800 bg-slate-950/50 p-2"
              >
                <div>
                  <div className="text-xs font-medium text-slate-200">{p.label}</div>
                  <div className="text-[11px] text-slate-500">{p.desc}</div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0"
                  onClick={() => {
                    if (viewMode === 'Site Layout') {
                      setLayoutPlaceType(p.type);
                      setSaveMsg('Click the floor plan to place this device.');
                      return;
                    }
                    if (viewMode === 'CAD Layout') {
                      setCadPlaceType(p.type);
                      setSaveMsg('Click the CAD drawing to place this device.');
                      return;
                    }
                    void addPaletteDevice(p.type);
                  }}
                  disabled={!siteId || (viewMode !== '3D Topology' && viewMode !== 'Site Layout' && viewMode !== 'CAD Layout')}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex min-h-0 flex-col gap-2">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {viewMode === 'Site Layout' && (
              <>
                <label className="text-xs text-slate-500">Floor plan</label>
                <select
                  value={selectedLayoutId ?? ''}
                  onChange={(e) => setSelectedLayoutId(e.target.value || null)}
                  className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
                >
                  {layouts.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.layoutName} ({l.fileType})
                    </option>
                  ))}
                </select>
                <label className="cursor-pointer rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700">
                  {layoutUploading ? 'Uploading…' : 'Upload layout'}
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !config) return;
                      setLayoutUploading(true);
                      try {
                        await uploadFloorPlan(config, {
                          siteId,
                          layoutName: file.name.replace(/\.[^.]+$/, '') || 'Floor plan',
                          file,
                        });
                        await queryClient.invalidateQueries({ queryKey: ['network-topology', siteId] });
                        setSaveMsg('Layout uploaded');
                        setTimeout(() => setSaveMsg(null), 2500);
                      } catch (err) {
                        setSaveMsg(err instanceof Error ? err.message : 'Upload failed');
                      } finally {
                        setLayoutUploading(false);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
                <Button
                  size="sm"
                  variant={showLayoutPaths ? 'secondary' : 'outline'}
                  onClick={() => setShowLayoutPaths((v) => !v)}
                >
                  Cable paths
                </Button>
                <Button size="sm" variant="outline" onClick={() => setLayoutPlaceType(null)}>
                  Cancel place
                </Button>
              </>
            )}

            {viewMode === 'CAD Layout' && (
              <>
                <label className="text-xs text-slate-500">CAD layout</label>
                <select
                  value={selectedCadLayoutId ?? ''}
                  onChange={(e) => setSelectedCadLayoutId(e.target.value || null)}
                  className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
                >
                  {cadLayouts.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.cadName} ({l.parseStatus})
                    </option>
                  ))}
                </select>
                <label className="cursor-pointer rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700">
                  {cadUploading ? 'Uploading…' : 'Import DXF'}
                  <input
                    type="file"
                    accept=".dxf,application/dxf"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !config) return;
                      setCadUploading(true);
                      try {
                        await uploadCadDxf(config, {
                          siteId,
                          cadName: file.name.replace(/\.[^.]+$/, '') || 'CAD layout',
                          file,
                        });
                        await queryClient.invalidateQueries({ queryKey: ['network-topology', siteId] });
                        setSaveMsg('CAD layout uploaded');
                        setTimeout(() => setSaveMsg(null), 2500);
                      } catch (err) {
                        setSaveMsg(err instanceof Error ? err.message : 'Upload failed');
                      } finally {
                        setCadUploading(false);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
                <Button
                  size="sm"
                  variant={showCadCablePaths ? 'secondary' : 'outline'}
                  onClick={() => setShowCadCablePaths((v) => !v)}
                >
                  Cable paths
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCadPlaceType(null)}>
                  Cancel place
                </Button>
              </>
            )}

            {(viewMode === 'Device Health' || viewMode === '3D Topology' || viewMode === 'PoE Load') &&
              siteId &&
              config && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={runSiteHealthMut.isPending}
                  onClick={() => void runSiteHealthMut.mutateAsync()}
                >
                  {runSiteHealthMut.isPending ? 'Running…' : 'Run site health'}
                </Button>
              )}

            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setConnectMode(true);
                setConnectSourceId(null);
              }}
              disabled={viewMode !== '3D Topology'}
              className={connectMode ? 'ring-1 ring-sky-400' : ''}
              aria-disabled={viewMode !== '3D Topology'}
            >
              <Link2 className="mr-1 h-4 w-4" />
              Connect devices
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void autoLayoutMut.mutate()} disabled={!siteId}>
              <Sparkles className="mr-1 h-4 w-4" />
              Auto layout
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void saveViewMut.mutate()} disabled={!siteId}>
              <Save className="mr-1 h-4 w-4" />
              Save view
            </Button>
            <Button size="sm" variant="outline" onClick={resetCamera}>
              <RotateCcw className="mr-1 h-4 w-4" />
              Reset view
            </Button>
            <Button size="sm" variant="outline" onClick={fitCamera}>
              <Maximize2 className="mr-1 h-4 w-4" />
              Fit
            </Button>
            <Button
              size="sm"
              variant={showLabels ? 'secondary' : 'outline'}
              onClick={() => setShowLabels((v) => !v)}
            >
              <Type className="mr-1 h-4 w-4" />
              Labels
            </Button>
            <Button
              size="sm"
              variant={statusGlow ? 'secondary' : 'outline'}
              onClick={() => setStatusGlow((v) => !v)}
            >
              Glow
            </Button>
            <Button size="sm" variant={showGrid ? 'secondary' : 'outline'} onClick={() => setShowGrid((v) => !v)}>
              <Grid3x3 className="mr-1 h-4 w-4" />
              Grid
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!siteId}
              onClick={() => {
                if (confirm('Replace existing topology on this site?')) void starterMut.mutate(true);
              }}
            >
              <LayoutTemplate className="mr-1 h-4 w-4" />
              Starter template
            </Button>
            {viewMode !== 'Site Layout' && viewMode !== 'CAD Layout' && (
              <div className="ml-auto flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-500">
                <ImageOff className="h-3.5 w-3.5" />
                Use Site Layout or CAD Layout for floor plans
              </div>
            )}
          </div>

          {connections.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="text-slate-500">Connections:</span>
              <select
                className="max-w-xs rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-slate-200"
                value={selectedConnId ?? ''}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) {
                    setSelectedConnId(null);
                    return;
                  }
                  setSelectedConnId(id);
                  setConnDrawer(true);
                }}
              >
                <option value="">Select to edit…</option>
                {connections.map((c) => {
                  const a = devices.find((d) => d.id === c.sourceDeviceId)?.displayName ?? 'A';
                  const b = devices.find((d) => d.id === c.targetDeviceId)?.displayName ?? 'B';
                  return (
                    <option key={c.id} value={c.id}>
                      {a} → {b}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

                    {connectMode && (
            <div className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">
              {connectSourceId
                ? 'Pick the target device. Click again to change source.'
                : 'Pick the source device first.'}{' '}
              <button type="button" className="ml-2 underline" onClick={() => setConnectMode(false)}>
                Cancel
              </button>
            </div>
          )}

          <div className="relative min-h-[420px] flex-1">
            {topologyQuery.isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-slate-950/70 text-slate-300">
                Loading topology…
              </div>
            )}
            {viewMode === '3D Topology' && siteId && (
              <>
                {devices.length === 0 && !topologyQuery.isLoading ? (
                  <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 bg-[#061826] p-8 text-center">
                    <p className="text-lg font-medium text-slate-200">No network topology created yet.</p>
                    <p className="mt-2 max-w-md text-sm text-slate-400">
                      Start by adding your router, switches, cameras, access points, and AI edge devices to build a
                      complete infrastructure map.
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                      <Button onClick={() => void addPaletteDevice('router')}>Add Router</Button>
                      <Button variant="secondary" onClick={() => void addPaletteDevice('poe_switch')}>
                        Add PoE Switch
                      </Button>
                      <Button variant="outline" onClick={() => void starterMut.mutate(false)}>
                        Use Starter Template
                      </Button>
                    </div>
                  </div>
                ) : (
                  <TopologyScene
                    devices={devices}
                    connections={connections}
                    selectedId={selectedId}
                    connectMode={connectMode}
                    connectSourceId={connectSourceId}
                    onSelectDevice={(id) => {
                      setSelectedId(id);
                      if (id) setSelectedConnId(null);
                    }}
                    onConnectPick={onConnectPick}
                    onPositionCommit={onPositionCommit}
                    showLabels={showLabels}
                    showGrid={showGrid}
                    statusGlow={statusGlow}
                    orbitRef={orbitRef}
                  />
                )}
              </>
            )}
            {viewMode === 'Site Layout' && siteId && config && (
              <TopologyLayoutCanvas
                config={config}
                activeLayout={selectedLayout}
                devices={devices}
                connections={connections}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  if (id) setSelectedConnId(null);
                }}
                onLayoutPosition={async (deviceId, nx, ny, layoutId) => {
                  await apiPatch(config, `/v1/infrastructure/network-topology/devices/${deviceId}/layout-position`, {
                    layoutId,
                    layoutPositionX: nx,
                    layoutPositionY: ny,
                  });
                  await queryClient.invalidateQueries({ queryKey: ['network-topology', siteId] });
                }}
                showLabels={showLabels}
                showCablePaths={showLayoutPaths}
                placementMode={!!layoutPlaceType}
                onCanvasClick={(nx, ny) => {
                  if (!layoutPlaceType || !selectedLayout) return;
                  void (async () => {
                    try {
                      await createDeviceMut.mutateAsync({
                        siteId,
                        deviceType: layoutPlaceType,
                        displayName:
                          PALETTE.find((x) => x.type === layoutPlaceType)?.label ?? layoutPlaceType,
                        status: 'unknown',
                        positionX: 0,
                        positionY: 0,
                        positionZ: 0,
                        layoutId: selectedLayout.id,
                        layoutPositionX: nx,
                        layoutPositionY: ny,
                      });
                      setLayoutPlaceType(null);
                      setDrawerOpen(true);
                    } catch (e) {
                      setSaveMsg(e instanceof Error ? e.message : 'Failed to place device');
                    }
                  })();
                }}
              />
            )}

            {viewMode === 'CAD Layout' && siteId && config && (
              <TopologyCadCanvas
                config={config}
                activeCadLayout={selectedCadLayout}
                cadLayers={topologyQuery.data?.cadLayers ?? []}
                devices={devices}
                connections={connections}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  if (id) setSelectedConnId(null);
                }}
                onCadPosition={async (deviceId, nx, ny, cadLayoutId) => {
                  await apiPatch(config, `/v1/infrastructure/network-topology/devices/${deviceId}/cad-position`, {
                    cadLayoutId,
                    cadPositionX: nx,
                    cadPositionY: ny,
                  });
                  await queryClient.invalidateQueries({ queryKey: ['network-topology', siteId] });
                }}
                showLabels={showLabels}
                showCablePaths={showCadCablePaths}
                placementMode={!!cadPlaceType}
                onCanvasClick={(nx, ny) => {
                  if (!cadPlaceType || !selectedCadLayout) return;
                  void (async () => {
                    try {
                      await createDeviceMut.mutateAsync({
                        siteId,
                        deviceType: cadPlaceType,
                        displayName:
                          PALETTE.find((x) => x.type === cadPlaceType)?.label ?? cadPlaceType,
                        status: 'unknown',
                        positionX: 0,
                        positionY: 0,
                        positionZ: 0,
                        cadLayoutId: selectedCadLayout.id,
                        cadPositionX: nx,
                        cadPositionY: ny,
                      });
                      setCadPlaceType(null);
                      setDrawerOpen(true);
                    } catch (e) {
                      setSaveMsg(e instanceof Error ? e.message : 'Failed to place device');
                    }
                  })();
                }}
              />
            )}

            {viewMode === 'Device Health' && siteId && (
              <div className="flex min-h-[420px] flex-col gap-4 rounded-lg border border-slate-800 bg-[#061826] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-200">Monitored devices</h3>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={runSiteHealthMut.isPending}
                    onClick={() => void runSiteHealthMut.mutateAsync()}
                  >
                    {runSiteHealthMut.isPending ? 'Running…' : 'Run all checks'}
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="border-b border-slate-700 text-slate-500">
                      <tr>
                        <th className="py-2 pr-2">Name</th>
                        <th className="py-2 pr-2">Type</th>
                        <th className="py-2 pr-2">IP</th>
                        <th className="py-2 pr-2">Health</th>
                        <th className="py-2 pr-2">Latency</th>
                        <th className="py-2 pr-2">Score</th>
                        <th className="py-2">Last check</th>
                      </tr>
                    </thead>
                    <tbody>
                      {devicesHealthList.map((h) => {
                        const d = devices.find((x) => x.id === h.deviceId);
                        return (
                          <tr key={h.deviceId} className="border-b border-slate-800/80">
                            <td className="py-1.5 pr-2">{d?.displayName ?? '—'}</td>
                            <td className="py-1.5 pr-2">{d?.deviceType ?? '—'}</td>
                            <td className="py-1.5 pr-2">{h.ipAddress}</td>
                            <td className="py-1.5 pr-2">
                              <Badge variant="outline">{h.currentStatus}</Badge>
                            </td>
                            <td className="py-1.5 pr-2">
                              {h.latencyMs != null ? `${Math.round(h.latencyMs)} ms` : '—'}
                            </td>
                            <td className="py-1.5 pr-2">{h.healthScore}</td>
                            <td className="py-1.5 text-slate-500">
                              {h.lastCheckedAt ? new Date(h.lastCheckedAt).toLocaleString() : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {devicesHealthList.length === 0 && (
                    <p className="py-6 text-center text-sm text-slate-500">
                      No health samples yet. Enable monitoring on devices with IPs, then run checks.
                    </p>
                  )}
                </div>
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Recent issues
                  </h4>
                  {recentFailuresList.length === 0 ? (
                    <p className="text-sm text-slate-500">No recent network issues found.</p>
                  ) : (
                    <ul className="space-y-2 text-xs">
                      {recentFailuresList.slice(0, 8).map((f) => (
                        <li
                          key={`${f.deviceId}-${f.checkedAt}`}
                          className="flex justify-between gap-2 rounded border border-slate-800 bg-slate-950/50 px-2 py-1"
                        >
                          <span className="text-slate-200">{f.displayName}</span>
                          <span className="text-slate-500">
                            {f.status}
                            {f.error ? ` — ${f.error}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {viewMode === 'PoE Load' && siteId && (
              <div className="grid gap-3 md:grid-cols-2">
                {devices
                  .filter((d) => d.deviceType === 'poe_switch')
                  .map((sw) => {
                    const meta = (sw.metadataJson ?? {}) as { poeBudgetWatts?: number };
                    const budget = meta.poeBudgetWatts ?? 370;
                    const used = poeDrawnWatts(sw.id, devices, connections);
                    const pct = budget > 0 ? Math.round((used / budget) * 100) : 0;
                    const band = pct >= 85 ? 'Critical' : pct >= 70 ? 'Warning' : 'Normal';
                    const border =
                      pct >= 85 ? 'border-red-500/40' : pct >= 70 ? 'border-amber-500/40' : 'border-slate-700';
                    return (
                      <Card key={sw.id} className={`border bg-slate-900 ${border}`}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-slate-100">{sw.displayName}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1 text-xs text-slate-400">
                          <div>Budget: {budget} W</div>
                          <div>Used (est.): {used} W</div>
                          <div>Available: {Math.max(0, budget - used)} W</div>
                          <div className="text-slate-200">
                            Load: {pct}% — {band}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                {devices.filter((d) => d.deviceType === 'poe_switch').length === 0 && (
                  <p className="text-sm text-slate-500">No PoE switches in this topology.</p>
                )}
              </div>
            )}

            {viewMode === 'Network Discovery' && siteId && (
              <div className="flex min-h-[420px] flex-col gap-4 rounded-lg border border-slate-800 bg-[#061826] p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">Network Discovery</h3>
                    <p className="mt-1 max-w-xl text-xs text-slate-500">
                      Private RFC1918 ranges only (max 256 targets). Jobs run via the discovery worker (
                      <code className="text-slate-400">npm run network-topology:discovery-worker</code>
                      ).
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                    <span>Pending suggestions: {pendingSuggestionsCount}</span>
                    <span>Unmatched hosts: {discoveredUnmatchedCount}</span>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500">Job name</label>
                    <input
                      className="w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
                      value={discJobName}
                      onChange={(e) => setDiscJobName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500">Scan type</label>
                    <select
                      className="w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
                      value={discScanType}
                      onChange={(e) =>
                        setDiscScanType(e.target.value as 'ping_tcp' | 'ping' | 'tcp')
                      }
                    >
                      <option value="ping_tcp">Ping + TCP</option>
                      <option value="ping">Ping only</option>
                      <option value="tcp">TCP only</option>
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs text-slate-500">Scan range (CIDR, range, or single IP)</label>
                    <input
                      className="w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
                      value={discScanRange}
                      onChange={(e) => setDiscScanRange(e.target.value)}
                      placeholder="192.168.1.0/24"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={startDiscoveryMut.isPending || !discScanRange.trim()}
                    onClick={() => void startDiscoveryMut.mutateAsync()}
                  >
                    {startDiscoveryMut.isPending ? 'Queueing…' : 'Start discovery job'}
                  </Button>
                  {latestDiscoveryJob?.status === 'completed' && latestDiscoveryJob?.id && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={generateDiscoverySuggestionsMut.isPending}
                      onClick={() =>
                        void generateDiscoverySuggestionsMut.mutateAsync(latestDiscoveryJob.id)
                      }
                    >
                      {generateDiscoverySuggestionsMut.isPending ? 'Generating…' : 'Generate suggestions'}
                    </Button>
                  )}
                </div>
                {latestDiscoveryJob && (
                  <div className="rounded-md border border-slate-700 bg-slate-950/40 p-3 text-xs text-slate-300">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span className="font-medium text-slate-200">Latest job</span>
                      <span>Status: {latestDiscoveryJob.status}</span>
                      <span>
                        Progress: {latestDiscoveryJob.scannedTargets}/{latestDiscoveryJob.totalTargets}
                      </span>
                      <span>Discovered: {latestDiscoveryJob.discoveredCount}</span>
                      <span>Matched: {latestDiscoveryJob.matchedCount}</span>
                    </div>
                    {latestDiscoveryJob.status === 'pending' || latestDiscoveryJob.status === 'running' ? (
                      <p className="mt-2 text-slate-500">Waiting for discovery worker — polling status…</p>
                    ) : null}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Bottom panel */}
      {selected && (
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="flex flex-wrap gap-4 py-3 text-sm">
            <div>
              <span className="text-slate-500">Device</span>{' '}
              <span className="font-medium text-slate-100">{selected.displayName}</span>
            </div>
            <div>
              <span className="text-slate-500">IP</span>{' '}
              <span className="text-slate-200">{selected.ipAddress ?? '—'}</span>
            </div>
            <div>
              <span className="text-slate-500">Type</span>{' '}
              <Badge variant="secondary">{selected.deviceType}</Badge>
            </div>
            <div>
              <span className="text-slate-500">Status</span>{' '}
              <Badge variant="outline">{selected.status}</Badge>
            </div>
            <div>
              <span className="text-slate-500">Parent</span>{' '}
              <span className="text-slate-300">{parentName(devices, selected.parentDeviceId)}</span>
            </div>
            <div>
              <span className="text-slate-500">Links</span>{' '}
              <span className="text-slate-300">{connectedCount(selected.id, connections)}</span>
            </div>
            <div>
              <span className="text-slate-500">PoE</span>{' '}
              <span className="text-slate-300">
                {selected.poeEnabled ? `${selected.poeWattage ?? '—'} W` : 'Off'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">VLAN</span>{' '}
              <span className="text-slate-300">{selected.vlan ?? '—'}</span>
            </div>
            <div>
              <span className="text-slate-500">Updated</span>{' '}
              <span className="text-slate-400">{new Date(selected.updatedAt).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit drawer */}
      <Sheet open={drawerOpen && !!selected} onClose={() => setDrawerOpen(false)} side="right">
        {selected && (
          <>
            <div className="border-b border-slate-800 px-4 py-3">
              <h2 className="text-lg font-semibold text-slate-100">Edit device</h2>
              <p className="text-xs text-slate-500">{selected.displayName}</p>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <Field
                label="Display name *"
                value={selected.displayName}
                onChange={(v) => void updateDeviceMut.mutateAsync({ id: selected.id, displayName: v })}
              />
              <SelectField
                label="Device type *"
                value={selected.deviceType}
                options={PALETTE.map((p) => p.type)}
                onChange={(v) => void updateDeviceMut.mutateAsync({ id: selected.id, deviceType: v })}
              />
              <Field
                label="Hostname"
                value={selected.hostname ?? ''}
                onChange={(v) => void updateDeviceMut.mutateAsync({ id: selected.id, hostname: v || null })}
              />
              <Field
                label="IP address"
                value={selected.ipAddress ?? ''}
                onChange={(v) => void updateDeviceMut.mutateAsync({ id: selected.id, ipAddress: v || null })}
              />
              <Field
                label="MAC address"
                value={selected.macAddress ?? ''}
                onChange={(v) => void updateDeviceMut.mutateAsync({ id: selected.id, macAddress: v || null })}
              />
              <Field
                label="VLAN"
                value={selected.vlan ?? ''}
                onChange={(v) => void updateDeviceMut.mutateAsync({ id: selected.id, vlan: v || null })}
              />
              <Field
                label="Subnet"
                value={selected.subnet ?? ''}
                onChange={(v) => void updateDeviceMut.mutateAsync({ id: selected.id, subnet: v || null })}
              />
              <Field
                label="Gateway"
                value={selected.gateway ?? ''}
                onChange={(v) => void updateDeviceMut.mutateAsync({ id: selected.id, gateway: v || null })}
              />
              <SelectField
                label="Status *"
                value={selected.status}
                options={['online', 'offline', 'warning', 'maintenance', 'unknown']}
                onChange={(v) => void updateDeviceMut.mutateAsync({ id: selected.id, status: v })}
              />
              <Field
                label="Location"
                value={selected.locationLabel ?? ''}
                onChange={(v) => void updateDeviceMut.mutateAsync({ id: selected.id, locationLabel: v || null })}
              />
              <Field
                label="Rack name"
                value={selected.rackName ?? ''}
                onChange={(v) => void updateDeviceMut.mutateAsync({ id: selected.id, rackName: v || null })}
              />
              <Field
                label="Port #"
                value={selected.portNumber ?? ''}
                onChange={(v) => void updateDeviceMut.mutateAsync({ id: selected.id, portNumber: v || null })}
              />
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={selected.poeEnabled}
                  onChange={(e) =>
                    void updateDeviceMut.mutateAsync({ id: selected.id, poeEnabled: e.target.checked })
                  }
                />
                PoE enabled
              </label>
              <Field
                label="PoE wattage"
                value={selected.poeWattage != null ? String(selected.poeWattage) : ''}
                onChange={(v) =>
                  void updateDeviceMut.mutateAsync({
                    id: selected.id,
                    poeWattage: v === '' ? null : Number(v),
                  })
                }
              />
              <Field
                label="Manufacturer"
                value={selected.manufacturer ?? ''}
                onChange={(v) => void updateDeviceMut.mutateAsync({ id: selected.id, manufacturer: v || null })}
              />
              <Field
                label="Model"
                value={selected.model ?? ''}
                onChange={(v) => void updateDeviceMut.mutateAsync({ id: selected.id, model: v || null })}
              />
              <Field
                label="Serial #"
                value={selected.serialNumber ?? ''}
                onChange={(v) => void updateDeviceMut.mutateAsync({ id: selected.id, serialNumber: v || null })}
              />
              <label className="block text-xs text-slate-500">Notes</label>
              <textarea
                className="min-h-[80px] w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
                defaultValue={selected.notes ?? ''}
                onBlur={(e) =>
                  void updateDeviceMut.mutateAsync({ id: selected.id, notes: e.target.value || null })
                }
              />

              <div className="border-t border-slate-800 pt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Monitoring
                </h3>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={selected.monitoringEnabled ?? false}
                    onChange={(e) =>
                      void patchMonitoringMut.mutateAsync({
                        id: selected.id,
                        monitoringEnabled: e.target.checked,
                      })
                    }
                  />
                  Enable reachability checks
                </label>
                <Field
                  label="Probe IP override"
                  value={selected.monitoringIp ?? ''}
                  onChange={(v) =>
                    void patchMonitoringMut.mutateAsync({
                      id: selected.id,
                      monitoringIp: v.trim() ? v.trim() : null,
                    })
                  }
                />
                <Field
                  label="TCP port (optional)"
                  value={selected.monitoringPort != null ? String(selected.monitoringPort) : ''}
                  onChange={(v) => {
                    const n = v === '' ? null : Number(v);
                    void patchMonitoringMut.mutateAsync({
                      id: selected.id,
                      monitoringPort: n != null && !Number.isNaN(n) ? n : null,
                    });
                  }}
                />
                <SelectField
                  label="Protocol hint"
                  value={selected.monitoringProtocol ?? 'auto'}
                  options={['auto', 'icmp', 'tcp']}
                  onChange={(v) =>
                    void patchMonitoringMut.mutateAsync({
                      id: selected.id,
                      monitoringProtocol: v === 'auto' ? null : v,
                    })
                  }
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  disabled={runDeviceHealthMut.isPending || patchMonitoringMut.isPending}
                  onClick={() => void runDeviceHealthMut.mutateAsync(selected.id)}
                >
                  {runDeviceHealthMut.isPending ? 'Running…' : 'Run check now'}
                </Button>
              </div>
            </div>
            <div className="flex gap-2 border-t border-slate-800 p-4">
              <Button variant="destructive" onClick={() => void deleteDeviceMut.mutate(selected.id)}>
                Delete
              </Button>
              <Button variant="secondary" onClick={() => void duplicateMut.mutate(selected.id)}>
                Duplicate
              </Button>
              <Button variant="outline" onClick={() => setDrawerOpen(false)}>
                Close
              </Button>
            </div>
          </>
        )}
      </Sheet>

      {/* Connection edit */}
      <Sheet open={connDrawer && !!selectedConn} onClose={() => setConnDrawer(false)} side="right">
        {selectedConn && (
          <>
            <div className="border-b border-slate-800 px-4 py-3">
              <h2 className="text-lg font-semibold text-slate-100">Edit connection</h2>
            </div>
            <div className="space-y-3 px-4 py-4">
              <SelectField
                label="Cable type"
                value={selectedConn.cableType}
                options={['cat6', 'fiber', 'wireless', 'uplink', 'poe', 'unknown']}
                onChange={(v) => void updateConnMut.mutateAsync({ id: selectedConn.id, cableType: v })}
              />
              <SelectField
                label="Status"
                value={selectedConn.status}
                options={['active', 'down', 'warning', 'unknown']}
                onChange={(v) => void updateConnMut.mutateAsync({ id: selectedConn.id, status: v })}
              />
              <Field
                label="Port from"
                value={selectedConn.portFrom ?? ''}
                onChange={(v) => void updateConnMut.mutateAsync({ id: selectedConn.id, portFrom: v || null })}
              />
              <Field
                label="Port to"
                value={selectedConn.portTo ?? ''}
                onChange={(v) => void updateConnMut.mutateAsync({ id: selectedConn.id, portTo: v || null })}
              />
              <Field
                label="Bandwidth label"
                value={selectedConn.bandwidthLabel ?? ''}
                onChange={(v) =>
                  void updateConnMut.mutateAsync({ id: selectedConn.id, bandwidthLabel: v || null })
                }
              />
              <Field
                label="VLAN label"
                value={selectedConn.vlanLabel ?? ''}
                onChange={(v) => void updateConnMut.mutateAsync({ id: selectedConn.id, vlanLabel: v || null })}
              />
            </div>
            <div className="p-4">
              <Button variant="outline" onClick={() => setConnDrawer(false)}>
                Close
              </Button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-500">{label}</label>
      <input
        className="w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-500">{label}</label>
      <select
        className="w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
