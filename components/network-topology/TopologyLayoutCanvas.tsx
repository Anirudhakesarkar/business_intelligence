/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Config } from '@/lib/types';
import type { TopologyConnection, TopologyDevice, TopologyLayout } from './types';

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
  activeLayout: TopologyLayout | null;
  devices: TopologyDevice[];
  connections: TopologyConnection[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onLayoutPosition: (
    deviceId: string,
    nx: number,
    ny: number,
    layoutId: string
  ) => Promise<void>;
  showLabels: boolean;
  showCablePaths: boolean;
  placementMode: boolean;
  onCanvasClick: (nx: number, ny: number) => void;
};

export function TopologyLayoutCanvas({
  config,
  activeLayout,
  devices,
  connections,
  selectedId,
  onSelect,
  onLayoutPosition,
  showLabels,
  showCablePaths,
  placementMode,
  onCanvasClick,
}: Props) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, { x: number; y: number }>>({});

  const base = useMemo(
    () => (config.serverUrl || '').replace(/\/$/, ''),
    [config.serverUrl]
  );

  const assetUrl = useCallback(
    (path: string) => `${base}${path.startsWith('/') ? path : `/${path}`}`,
    [base]
  );

  useEffect(() => {
    setLocal({});
  }, [activeLayout?.id, devices]);

  const layoutDevices = useMemo(() => {
    if (!activeLayout) return [];
    return devices.filter((d) => d.layoutId === activeLayout.id);
  }, [devices, activeLayout]);

  const pointerToNorm = (clientX: number, clientY: number) => {
    const el = innerRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const nx = (clientX - r.left) / r.width;
    const ny = (clientY - r.top) / r.height;
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
    return {
      nx: Math.min(1, Math.max(0, nx)),
      ny: Math.min(1, Math.max(0, ny)),
    };
  };

  const handlePlacementClick = (e: React.PointerEvent) => {
    if (!placementMode) return;
    const n = pointerToNorm(e.clientX, e.clientY);
    if (n) onCanvasClick(n.nx, n.ny);
  };

  const beginDrag = (deviceId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging(deviceId);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    if (!dragging || !activeLayout) return;
    const move = (ev: PointerEvent) => {
      const n = pointerToNorm(ev.clientX, ev.clientY);
      if (!n) return;
      setLocal((prev) => ({ ...prev, [dragging]: { x: n.nx, y: n.ny } }));
    };
    const up = async (ev: PointerEvent) => {
      const n = pointerToNorm(ev.clientX, ev.clientY);
      const id = dragging;
      setDragging(null);
      if (!n || !activeLayout || !id) return;
      await onLayoutPosition(id, n.nx, n.ny, activeLayout.id);
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
  }, [dragging, activeLayout, onLayoutPosition]);

  if (!activeLayout) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 bg-[#061826] p-8 text-center">
        <p className="text-lg font-medium text-slate-200">No site layout uploaded yet.</p>
        <p className="mt-2 max-w-md text-sm text-slate-400">
          Upload a PDF or image floor plan to place routers, PoE switches, access points, cameras, and AI edge devices on
          the real site layout.
        </p>
        <p className="mt-4 text-xs text-slate-500">Supported: PDF, PNG, JPG, WebP</p>
      </div>
    );
  }

  const bg =
    activeLayout.fileType === 'pdf'
      ? activeLayout.previewImageUrl || activeLayout.fileUrl
      : activeLayout.previewImageUrl || activeLayout.fileUrl;

  const isPdf = activeLayout.fileType === 'pdf' && !activeLayout.previewImageUrl;

  return (
    <div className="relative flex min-h-[480px] flex-col rounded-lg border border-slate-800 bg-[#0b2538]">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-xs text-slate-400">
        <span className="truncate font-medium text-sky-200">{activeLayout.layoutName}</span>
      </div>
      <div className="relative max-h-[70vh] overflow-auto">
        <div ref={innerRef} className="relative inline-block min-w-full">
          {isPdf ? (
            <embed
              src={assetUrl(activeLayout.fileUrl)}
              type="application/pdf"
              className="pointer-events-none block min-h-[480px] w-full bg-slate-900"
            />
          ) : (
            <img
              src={assetUrl(bg)}
              alt={activeLayout.layoutName}
              draggable={false}
              className="pointer-events-none block w-full select-none object-contain"
            />
          )}

          {placementMode && (
            <button
              type="button"
              aria-label="Place device"
              tabIndex={-1}
              onPointerDown={handlePlacementClick}
              className="absolute inset-0 z-[5] cursor-crosshair bg-transparent"
            />
          )}

          {showCablePaths && (
            <svg
              className="pointer-events-none absolute inset-0 z-[6] h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {connections
                .filter((c) => c.layoutId === activeLayout.id)
                .map((c) => {
                  const a = layoutDevices.find((d) => d.id === c.sourceDeviceId);
                  const b = layoutDevices.find((d) => d.id === c.targetDeviceId);
                  if (!a || !b) return null;
                  const pa = local[a.id] ?? {
                    x: a.layoutPositionX ?? 0.5,
                    y: a.layoutPositionY ?? 0.5,
                  };
                  const pb = local[b.id] ?? {
                    x: b.layoutPositionX ?? 0.5,
                    y: b.layoutPositionY ?? 0.5,
                  };
                  let dPath = '';
                  const pts = c.pathPointsJson as { x: number; y: number }[] | undefined;
                  if (pts && Array.isArray(pts) && pts.length > 1) {
                    dPath = pts
                      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * 100} ${p.y * 100}`)
                      .join(' ');
                  } else {
                    dPath = `M ${pa.x * 100} ${pa.y * 100} L ${pb.x * 100} ${pb.y * 100}`;
                  }
                  const stroke =
                    c.cableType === 'fiber'
                      ? '#7dd3fc'
                      : c.cableType === 'wireless'
                        ? '#94a3b8'
                        : '#38bdf8';
                  const dash = c.cableType === 'wireless' ? '4 3' : undefined;
                  return (
                    <path
                      key={c.id}
                      d={dPath}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={0.35}
                      strokeDasharray={dash}
                      opacity={0.95}
                    />
                  );
                })}
            </svg>
          )}

          {layoutDevices.map((d) => {
            const lx = local[d.id]?.x ?? d.layoutPositionX ?? 0.5;
            const ly = local[d.id]?.y ?? d.layoutPositionY ?? 0.5;
            const sel = selectedId === d.id;
            return (
              <div
                key={d.id}
                style={{ left: `${lx * 100}%`, top: `${ly * 100}%` }}
                className="absolute z-[15] -translate-x-1/2 -translate-y-1/2 transform"
              >
                <button
                  type="button"
                  onPointerDown={(e) => beginDrag(d.id, e)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(d.id);
                  }}
                  className={`flex max-w-[160px] flex-col rounded-lg border bg-slate-950/90 px-2 py-1 text-left shadow-lg backdrop-blur-sm ring-2 ${statusRing(
                    d.status
                  )} ${sel ? 'border-sky-400' : 'border-sky-500/40'}`}
                >
                  <span className="truncate text-[11px] font-semibold text-sky-50">{d.displayName}</span>
                  {showLabels && (
                    <span className="truncate text-[10px] text-slate-300">{d.ipAddress ?? '—'}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {placementMode && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-md bg-sky-500/20 px-2 py-1 text-[11px] text-sky-100">
            Click on the floor plan to place the device
          </div>
        )}
      </div>
    </div>
  );
}

export async function uploadFloorPlan(
  config: Config,
  params: { siteId: string; floorId?: string; layoutName: string; file: File }
) {
  const fd = new FormData();
  fd.append('siteId', params.siteId);
  if (params.floorId) fd.append('floorId', params.floorId);
  fd.append('layoutName', params.layoutName);
  fd.append('file', params.file);
  const headers: Record<string, string> = {};
  if (config.token) headers.Authorization = `Bearer ${config.token}`;
  if (config.apiKey) headers['X-API-Key'] = config.apiKey;
  headers['X-Site-Id'] = params.siteId;
  const res = await fetch(`${config.serverUrl.replace(/\/$/, '')}/v1/infrastructure/network-topology/layouts/upload`, {
    method: 'POST',
    body: fd,
    headers,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || `Upload failed (${res.status})`);
  return json as { ok: boolean; layout: TopologyLayout };
}
