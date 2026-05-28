/* eslint-disable react/no-unknown-property */
'use client';

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { TopologyDevice, TopologyConnection } from './types';

const BG = '#061826';
const SKY = '#38BDF8';

function statusColor(status: string): string {
  switch (status) {
    case 'online':
      return '#22c55e';
    case 'offline':
      return '#EF4444';
    case 'warning':
      return '#F59E0B';
    case 'maintenance':
      return '#64748b';
    default:
      return '#667085';
  }
}

function connectionColor(status: string): string {
  switch (status) {
    case 'active':
      return SKY;
    case 'warning':
      return '#F59E0B';
    case 'down':
      return '#EF4444';
    default:
      return '#667085';
  }
}

/** Prefer live monitoring health over inventory status when present. */
function visualDeviceStatus(d: TopologyDevice): string {
  const h = d.healthStatus;
  if (h && h !== 'unknown') return h;
  return d.status;
}

function computeLinkVisualStatus(a: TopologyDevice, b: TopologyDevice): string {
  const sa = visualDeviceStatus(a);
  const sb = visualDeviceStatus(b);
  if (sa === 'offline' || sb === 'offline') return 'down';
  if (sa === 'warning' || sb === 'warning') return 'warning';
  if (sa === 'online' && sb === 'online') return 'active';
  return 'unknown';
}

type SceneProps = {
  devices: TopologyDevice[];
  connections: TopologyConnection[];
  selectedId: string | null;
  connectMode: boolean;
  connectSourceId: string | null;
  onSelectDevice: (id: string | null) => void;
  onConnectPick: (id: string) => void;
  onPositionCommit: (id: string, x: number, y: number, z: number) => void;
  showLabels: boolean;
  showGrid: boolean;
  statusGlow: boolean;
  orbitRef: React.RefObject<any>;
};

function DragPlaneHelper({
  dragId,
  devices,
  onMove,
  onEnd,
}: {
  dragId: string | null;
  devices: TopologyDevice[];
  onMove: (id: string, x: number, z: number) => void;
  onEnd: () => void;
}) {
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const devicesRef = useRef(devices);
  devicesRef.current = devices;

  useEffect(() => {
    if (!dragId) return;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const vec = new THREE.Vector2();
    const move = (e: PointerEvent) => {
      const dev = devicesRef.current.find((d) => d.id === dragId);
      if (!dev) return;
      plane.constant = -dev.positionY;
      const rect = gl.domElement.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      vec.set(mx, my);
      raycaster.setFromCamera(vec, camera);
      const pt = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, pt)) {
        onMove(dragId, pt.x, pt.z);
      }
    };
    const up = () => onEnd();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragId, camera, gl, raycaster, onMove, onEnd]);

  return null;
}

function DeviceSphere({
  device,
  selected,
  connectHighlight,
  showLabels,
  statusGlow,
  onSelect,
  onPointerDown,
}: {
  device: TopologyDevice;
  selected: boolean;
  connectHighlight: boolean;
  showLabels: boolean;
  statusGlow: boolean;
  onSelect: () => void;
  onPointerDown: (e: any) => void;
}) {
  const [hover, setHover] = useState(false);
  const col = statusColor(visualDeviceStatus(device));
  const ring = selected || connectHighlight ? SKY : hover ? '#94a3b8' : 'transparent';

  return (
    <group position={[device.positionX, device.positionY, device.positionZ]}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          onPointerDown(e);
        }}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <sphereGeometry args={[0.45, 28, 28]} />
        <meshStandardMaterial
          color={col}
          emissive={statusGlow ? col : '#000000'}
          emissiveIntensity={statusGlow ? 0.35 : 0}
          metalness={0.2}
          roughness={0.45}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.55, 0.04, 12, 48]} />
        <meshBasicMaterial color={ring} transparent opacity={ring === 'transparent' ? 0 : 0.9} />
      </mesh>
      {showLabels && (
        <Html center distanceFactor={10} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="rounded bg-black/70 px-1.5 py-0.5 text-center shadow-lg backdrop-blur-sm">
            <div className="max-w-[140px] truncate text-[11px] font-semibold text-sky-100">{device.displayName}</div>
            <div className="text-[10px] text-slate-300">{device.ipAddress ?? '—'}</div>
            {device.healthScore != null && (
              <div className="text-[9px] text-sky-400/90">Health {device.healthScore}</div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

export function TopologyScene({
  devices,
  connections,
  selectedId,
  connectMode,
  connectSourceId,
  onSelectDevice,
  onConnectPick,
  onPositionCommit,
  showLabels,
  showGrid,
  statusGlow,
  orbitRef,
}: SceneProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [live, setLive] = useState<TopologyDevice[]>(devices);

  useEffect(() => {
    if (orbitRef?.current) orbitRef.current.enabled = !dragId;
  }, [dragId, orbitRef]);

  useEffect(() => {
    setLive(devices);
  }, [devices]);

  const onMove = useCallback((id: string, x: number, z: number) => {
    setLive((prev) =>
      prev.map((d) => (d.id === id ? { ...d, positionX: x, positionZ: z } : d)),
    );
  }, []);

  const onDragEnd = useCallback(() => {
    if (!dragId) return;
    const d = live.find((x) => x.id === dragId);
    setDragId(null);
    if (d) onPositionCommit(dragId, d.positionX, d.positionY, d.positionZ);
  }, [dragId, live, onPositionCommit]);

  const handlePointerDown = (device: TopologyDevice, e: any) => {
    if (connectMode) return;
    e.target.setPointerCapture?.(e.pointerId);
    setDragId(device.id);
  };

  return (
    <div className="relative h-full min-h-[420px] w-full rounded-lg border border-slate-800 bg-[#061826]">
      <Canvas
        camera={{ position: [0, 10, 14], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        onPointerMissed={() => onSelectDevice(null)}
      >
        <color attach="background" args={[BG]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[8, 14, 6]} intensity={1.1} />
        <directionalLight position={[-6, 10, -8]} intensity={0.35} color="#38bdf8" />

        <DragPlaneHelper
          dragId={dragId}
          devices={live}
          onMove={onMove}
          onEnd={onDragEnd}
        />

        {showGrid && (
          <Grid
            infiniteGrid
            fadeDistance={42}
            fadeStrength={5}
            sectionColor="#1e3a52"
            cellColor="#0b2538"
            sectionThickness={1}
            cellThickness={0.6}
          />
        )}

        {connections.map((c) => {
          const a = live.find((d) => d.id === c.sourceDeviceId);
          const b = live.find((d) => d.id === c.targetDeviceId);
          if (!a || !b) return null;
          return (
            <Line
              key={c.id}
              points={[
                [a.positionX, a.positionY, a.positionZ],
                [b.positionX, b.positionY, b.positionZ],
              ]}
              color={connectionColor(computeLinkVisualStatus(a, b))}
              lineWidth={2}
              transparent
              opacity={0.95}
            />
          );
        })}

        {live.map((d) => (
          <DeviceSphere
            key={d.id}
            device={d}
            selected={selectedId === d.id}
            connectHighlight={connectMode && connectSourceId === d.id}
            showLabels={showLabels}
            statusGlow={statusGlow}
            onSelect={() => (connectMode ? onConnectPick(d.id) : onSelectDevice(d.id))}
            onPointerDown={(e) => handlePointerDown(d, e)}
          />
        ))}

        <OrbitControls ref={orbitRef} makeDefault minPolarAngle={0.15} maxPolarAngle={Math.PI / 2.05} />
      </Canvas>
    </div>
  );
}
