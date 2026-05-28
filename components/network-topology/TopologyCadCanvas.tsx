'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Config } from '@/lib/types';
import type { TopologyCadLayer, TopologyCadLayout, TopologyConnection, TopologyDevice } from './types';

type CadGeomJson = {
  version: 1;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  insunits: number | null;
  entities: Array<
    | { t: 'L'; layer: string; x1: number; y1: number; x2: number; y2: number }
    | { t: 'P'; layer: string; closed: boolean; pts: [number, number][] }
    | { t: 'C'; layer: string; cx: number; cy: number; r: number }
    | { t: 'A'; layer: string; cx: number; cy: number; r: number; sa: number; ea: number }
    | { t: 'T'; layer: string; x: number; y: number; h: number; txt: string }
  >;
  warnings: string[];
};

function normToWorld(
  nx: number,
  ny: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
) {
  const wx = minX + nx * (maxX - minX);
  const wy = minY + ny * (maxY - minY);
  return { wx, wy };
}

function worldToNorm(
  wx: number,
  wy: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
) {
  const nx = (wx - minX) / (maxX - minX || 1);
  const ny = (wy - minY) / (maxY - minY || 1);
  return {
    nx: Math.min(1, Math.max(0, nx)),
    ny: Math.min(1, Math.max(0, ny)),
  };
}

function statusRing(status: string): string {
  switch (status) {
    case 'online':
      return 'ring-emerald-400/80';
    case 'offline':
      return 'ring-red-400/80';
    case 'warning':
      return 'ring-amber-400/80';
    default:
      return 'ring-slate-500/80';
  }
}

type Props = {
  config: Config;
  activeCadLayout: TopologyCadLayout | null;
  cadLayers: TopologyCadLayer[];
  devices: TopologyDevice[];
  connections: TopologyConnection[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCadPosition: (deviceId: string, nx: number, ny: number, cadLayoutId: string) => Promise<void>;
  showLabels: boolean;
  showCablePaths: boolean;
  placementMode: boolean;
  onCanvasClick: (nx: number, ny: number) => void;
};

export function TopologyCadCanvas({
  config,
  activeCadLayout,
  cadLayers,
  devices,
  connections,
  selectedId,
  onSelect,
  onCadPosition,
  showLabels,
  showCablePaths,
  placementMode,
  onCanvasClick,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [geom, setGeom] = useState<CadGeomJson | null>(null);
  const [geomErr, setGeomErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, { nx: number; ny: number }>>({});

  const base = useMemo(() => (config.serverUrl || '').replace(/\/$/, ''), [config.serverUrl]);

  const assetUrl = useCallback(
    (path: string) => `${base}${path.startsWith('/') ? path : `/${path}`}`,
    [base]
  );

  const geometryUrl = useMemo(() => {
    const m = activeCadLayout?.metadataJson as { geometryUrl?: string } | null;
    return typeof m?.geometryUrl === 'string' ? m.geometryUrl : null;
  }, [activeCadLayout]);

  useEffect(() => {
    setGeom(null);
    setGeomErr(null);
    if (!geometryUrl) return;
    let cancelled = false;
    void (async () => {
      try {
        const headers: Record<string, string> = {};
        if (config.token) headers.Authorization = `Bearer ${config.token}`;
        if (config.apiKey) headers['X-API-Key'] = config.apiKey;
        if (activeCadLayout?.siteId) headers['X-Site-Id'] = activeCadLayout.siteId;
        const res = await fetch(assetUrl(geometryUrl), { headers });
        if (!res.ok) throw new Error(`Geometry fetch failed (${res.status})`);
        const j = (await res.json()) as CadGeomJson;
        if (!cancelled) setGeom(j);
      } catch (e) {
        if (!cancelled) setGeomErr(e instanceof Error ? e.message : 'Geometry load failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [geometryUrl, assetUrl, config.token, config.apiKey, activeCadLayout?.siteId]);

  useEffect(() => {
    setLocal({});
  }, [activeCadLayout?.id, devices]);

  const layerHidden = useCallback(
    (layerName: string) => {
      const row = cadLayers.find((l) => l.layerName === layerName);
      if (!row) return false;
      return !row.isVisible;
    },
    [cadLayers]
  );

  const bounds = geom?.bounds ?? {
    minX: activeCadLayout?.minX ?? 0,
    minY: activeCadLayout?.minY ?? 0,
    maxX: activeCadLayout?.maxX ?? 1,
    maxY: activeCadLayout?.maxY ?? 1,
  };
  const bw = bounds.maxX - bounds.minX || 1;
  const bh = bounds.maxY - bounds.minY || 1;

  const cadDevices = useMemo(() => {
    if (!activeCadLayout) return [];
    return devices.filter((d) => d.cadLayoutId === activeCadLayout.id);
  }, [devices, activeCadLayout]);

  const svgPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = svgRef.current;
      if (!el) return null;
      const pt = el.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const ctm = el.getScreenCTM();
      if (!ctm) return null;
      const p = pt.matrixTransform(ctm.inverse());
      return { wx: p.x, wy: p.y };
    },
    []
  );

  const handleSvgClick = (e: React.MouseEvent) => {
    if (!placementMode || !activeCadLayout) return;
    const p = svgPoint(e.clientX, e.clientY);
    if (!p) return;
    const n = worldToNorm(p.wx, p.wy, bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
    onCanvasClick(n.nx, n.ny);
  };

  const beginDrag = (deviceId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging(deviceId);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    if (!dragging || !activeCadLayout) return;
    const move = (ev: PointerEvent) => {
      const p = svgPoint(ev.clientX, ev.clientY);
      if (!p) return;
      const n = worldToNorm(p.wx, p.wy, bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
      setLocal((prev) => ({ ...prev, [dragging]: { nx: n.nx, ny: n.ny } }));
    };
    const up = async (ev: PointerEvent) => {
      const p = svgPoint(ev.clientX, ev.clientY);
      const id = dragging;
      setDragging(null);
      if (!p || !activeCadLayout || !id) return;
      const n = worldToNorm(p.wx, p.wy, bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
      await onCadPosition(id, n.nx, n.ny, activeCadLayout.id);
      setLocal((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragging, activeCadLayout, bounds, onCadPosition, svgPoint]);

  if (!activeCadLayout) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 bg-[#061826] p-8 text-center">
        <p className="text-lg font-medium text-slate-200">No CAD layout imported yet.</p>
        <p className="mt-2 max-w-md text-sm text-slate-400">
          Upload a DXF floor plan to map routers, PoE switches, cameras, access points, servers, and cable routes on an
          engineering-grade site layout.
        </p>
        <p className="mt-4 text-xs text-slate-500">Supported in this phase: DXF</p>
      </div>
    );
  }

  if (activeCadLayout.parseStatus === 'failed') {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-red-900/50 bg-[#1a0a0a] p-8 text-center">
        <p className="text-lg font-medium text-red-200">CAD import failed</p>
        <p className="mt-2 max-w-md text-sm text-red-300/90">{activeCadLayout.parseError ?? 'Could not parse DXF.'}</p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[480px] flex-col rounded-lg border border-slate-800 bg-[#0b2538]">
      {(geom?.warnings?.length ?? 0) > 0 && (
        <div className="border-b border-amber-900/40 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
          Some CAD entities may not be rendered in this version. {geom?.warnings?.slice(0, 2).join(' ')}
        </div>
      )}
      {geomErr && (
        <div className="border-b border-red-900/40 bg-red-950/30 px-3 py-2 text-xs text-red-200">{geomErr}</div>
      )}
      <div className="relative min-h-[460px] flex-1 overflow-hidden p-2">
        <svg
          ref={svgRef}
          role="presentation"
          className="h-full w-full touch-none select-none bg-[#0a1824]"
          viewBox={`${bounds.minX} ${bounds.minY} ${bw} ${bh}`}
          preserveAspectRatio="xMidYMid meet"
          onClick={handleSvgClick}
        >
          <rect
            x={bounds.minX}
            y={bounds.minY}
            width={bw}
            height={bh}
            fill="#0a1824"
            stroke="#1e3a4f"
            strokeWidth={bw * 0.001}
          />
          {geom?.entities.map((e, i) => {
            if (cadLayers.length > 0 && layerHidden(e.layer)) return null;

            const stroke = '#6b8fa3';
            const sw = Math.max(bw * 0.0008, 0.05);
            if (e.t === 'L') {
              return (
                <line
                  key={i}
                  x1={e.x1}
                  y1={e.y1}
                  x2={e.x2}
                  y2={e.y2}
                  stroke={stroke}
                  strokeWidth={sw}
                  vectorEffect="non-scaling-stroke"
                />
              );
            }
            if (e.t === 'P') {
              const d = e.pts.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
              const close = e.closed ? ' Z' : '';
              return (
                <path
                  key={i}
                  d={d + close}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={sw}
                  vectorEffect="non-scaling-stroke"
                />
              );
            }
            if (e.t === 'C') {
              return (
                <circle
                  key={i}
                  cx={e.cx}
                  cy={e.cy}
                  r={e.r}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={sw}
                  vectorEffect="non-scaling-stroke"
                />
              );
            }
            if (e.t === 'A') {
              const large = Math.abs(e.ea - e.sa) > Math.PI ? 1 : 0;
              const sweep = e.ea > e.sa ? 1 : 0;
              const x1 = e.cx + e.r * Math.cos(e.sa);
              const y1 = e.cy + e.r * Math.sin(e.sa);
              const x2 = e.cx + e.r * Math.cos(e.ea);
              const y2 = e.cy + e.r * Math.sin(e.ea);
              const d = `M ${x1} ${y1} A ${e.r} ${e.r} 0 ${large} ${sweep} ${x2} ${y2}`;
              return (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={sw}
                  vectorEffect="non-scaling-stroke"
                />
              );
            }
            if (e.t === 'T') {
              return (
                <text
                  key={i}
                  x={e.x}
                  y={e.y}
                  fill="#94a3b8"
                  fontSize={Math.max(e.h, bw * 0.003)}
                  style={{ fontFamily: 'system-ui, sans-serif' }}
                >
                  {e.txt}
                </text>
              );
            }
            return null;
          })}

          {showCablePaths &&
            connections
              .filter((c) => c.cadLayoutId === activeCadLayout.id && c.cadPathPointsJson)
              .map((c) => {
                const pts = c.cadPathPointsJson as { x: number; y: number }[] | null;
                if (!pts || !Array.isArray(pts) || pts.length < 2) return null;
                const d = pts
                  .map((p, j) => {
                    const { wx, wy } = normToWorld(p.x, p.y, bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
                    return `${j === 0 ? 'M' : 'L'} ${wx} ${wy}`;
                  })
                  .join(' ');
                const col =
                  c.cableType === 'fiber'
                    ? '#22d3ee'
                    : c.cableType === 'wireless'
                      ? '#94a3b8'
                      : c.cableType === 'cat6'
                        ? '#38bdf8'
                        : '#64748b';
                return (
                  <path
                    key={c.id}
                    d={d}
                    fill="none"
                    stroke={col}
                    strokeWidth={Math.max(bw * 0.0012, 0.08)}
                    strokeDasharray={c.cableType === 'wireless' ? '4 3' : undefined}
                    opacity={0.9}
                  />
                );
              })}
        </svg>

        {/* DOM overlay markers — percentages match normalized CAD storage */}
        <div className="pointer-events-none absolute inset-2">
          {cadDevices.map((d) => {
            const lx = local[d.id];
            const nx = lx?.nx ?? d.cadPositionX ?? 0.5;
            const ny = lx?.ny ?? d.cadPositionY ?? 0.5;
            const leftPct = nx * 100;
            const topPct = ny * 100;
            const sel = selectedId === d.id;
            return (
              <button
                key={d.id}
                type="button"
                title={d.displayName}
                className={`pointer-events-auto absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-slate-900 bg-slate-800 text-[10px] text-slate-100 shadow-lg ring-2 ${statusRing(d.status)} ${sel ? 'ring-cyan-400' : ''}`}
                style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelect(d.id);
                }}
                onPointerDown={(e) => beginDrag(d.id, e)}
              >
                {d.deviceType === 'camera' ? '📹' : d.deviceType.includes('switch') ? '🔌' : '📡'}
              </button>
            );
          })}
        </div>
      </div>

      {placementMode && (
        <div className="border-t border-slate-800 bg-slate-950/80 px-3 py-2 text-center text-xs text-cyan-200">
          Click the drawing to place the selected asset ({cadDevices.length} devices on this CAD layout).
        </div>
      )}

      {showLabels && cadDevices.length > 0 && (
        <div className="border-t border-slate-800 px-3 py-2 text-[11px] text-slate-400">
          IP labels follow device markers. Select a device to edit details in the drawer.
        </div>
      )}
    </div>
  );
}

export async function uploadCadDxf(
  config: Config,
  params: { siteId: string; floorId?: string; cadName: string; file: File }
) {
  const fd = new FormData();
  fd.append('siteId', params.siteId);
  if (params.floorId) fd.append('floorId', params.floorId);
  fd.append('cadName', params.cadName);
  fd.append('file', params.file);
  const headers: Record<string, string> = {};
  if (config.token) headers.Authorization = `Bearer ${config.token}`;
  if (config.apiKey) headers['X-API-Key'] = config.apiKey;
  headers['X-Site-Id'] = params.siteId;
  const res = await fetch(
    `${config.serverUrl.replace(/\/$/, '')}/v1/infrastructure/network-topology/cad-layouts/upload`,
    {
      method: 'POST',
      body: fd,
      headers,
    }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || `Upload failed (${res.status})`);
  return json as { ok: boolean; layout: TopologyCadLayout };
}
