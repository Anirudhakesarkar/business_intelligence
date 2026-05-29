'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { SMPageHeader } from '@/components/school-management/SMPageHeader';
import { schoolApiGet } from '@/lib/school-management/api';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, DoorOpen, Layers, Building2, School, Clock, Wifi } from 'lucide-react';

const ORG_ID = 1;

type Row = Record<string, unknown>;

type CameraRow = {
  id: number; cameraCode: string; name: string;
  purpose: string; processOwner: string; criticality: string; status: string;
  zoneId?: number; roomId?: number; streamUrl?: string;
  activeFrom?: string; activeTo?: string; organizationId?: number;
};

function useSpatial() {
  const sites     = useQuery({ queryKey: ['sm-sites', ORG_ID],     queryFn: () => schoolApiGet<Row[]>(`/api/sites?organizationId=${ORG_ID}`) });
  const buildings = useQuery({ queryKey: ['sm-buildings', ORG_ID], queryFn: () => schoolApiGet<Row[]>(`/api/buildings?organizationId=${ORG_ID}`) });
  const floors    = useQuery({ queryKey: ['sm-floors', ORG_ID],    queryFn: () => schoolApiGet<Row[]>(`/api/floors?organizationId=${ORG_ID}`) });
  const zones     = useQuery({ queryKey: ['sm-zones', ORG_ID],     queryFn: () => schoolApiGet<Row[]>(`/api/zones?organizationId=${ORG_ID}`) });
  const rooms     = useQuery({ queryKey: ['sm-rooms', ORG_ID],     queryFn: () => schoolApiGet<Row[]>(`/api/rooms?organizationId=${ORG_ID}`) });
  return {
    sites:     Array.isArray(sites.data)     ? sites.data     : [],
    buildings: Array.isArray(buildings.data) ? buildings.data : [],
    floors:    Array.isArray(floors.data)    ? floors.data    : [],
    zones:     Array.isArray(zones.data)     ? zones.data     : [],
    rooms:     Array.isArray(rooms.data)     ? rooms.data     : [],
  };
}

function statusColor(s: string) {
  if (s === 'Active')      return 'bg-green-500/10 text-green-400';
  if (s === 'Offline')     return 'bg-red-500/10 text-red-400';
  if (s === 'Maintenance') return 'bg-amber-500/10 text-amber-400';
  return 'bg-slate-700 text-slate-400';
}
function critColor(c: string) {
  if (c === 'Critical') return 'bg-red-500/10 text-red-400';
  if (c === 'High')     return 'bg-amber-500/10 text-amber-400';
  if (c === 'Low')      return 'bg-green-500/10 text-green-400';
  return 'bg-slate-700 text-slate-400';
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm text-slate-200">{value || '—'}</p>
    </div>
  );
}

function Pill({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

export default function CameraDetailPage() {
  const params = useParams();
  const cameraId = Number(params.id);
  const { data: cam, isLoading, error } = useQuery({
    queryKey: ['sm-camera', cameraId],
    queryFn: () => schoolApiGet<CameraRow>(`/api/cameras/${cameraId}`),
    enabled: Number.isFinite(cameraId) && cameraId > 0,
  });
  const { sites, buildings, floors, zones, rooms } = useSpatial();

  // Resolve full location breadcrumb from zoneId / roomId
  const zone     = cam?.zoneId  != null ? zones.find((z) => Number(z.id) === cam.zoneId)  : null;
  const room     = cam?.roomId  != null ? rooms.find((r) => Number(r.id) === cam.roomId)  : null;
  const floor    = zone ? floors.find((f) => Number(f.id) === Number(zone.floorId))       : null;
  const building = floor ? buildings.find((b) => Number(b.id) === Number(floor.buildingId)) : null;
  const site     = building ? sites.find((s) => Number(s.id) === Number(building.siteId))  : null;

  return (
    <div className="space-y-6">
      <SMPageHeader
        title={cam ? `${cam.cameraCode} — ${cam.name}` : 'Camera detail'}
        subtitle="Governance fields for this camera — purpose, location, process owner, and active hours."
      />

      <Link href="/dashboard/school-management/cameras" className="inline-flex items-center gap-1 text-sm text-sky-400 hover:underline">
        ← Back to Cameras
      </Link>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : error || !cam ? (
        <p className="text-sm text-red-400">Camera not found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">

          {/* ── Identity ── */}
          <Card className="border-slate-800 bg-slate-900/50 sm:col-span-2">
            <CardContent className="p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Identity</p>
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="Camera Code" value={cam.cameraCode} />
                <Field label="Name"        value={cam.name} />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</p>
                  <Pill label={cam.status} cls={statusColor(cam.status)} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Criticality</p>
                  <Pill label={cam.criticality} cls={critColor(cam.criticality)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Purpose & ownership ── */}
          <Card className="border-slate-800 bg-slate-900/50">
            <CardContent className="p-4 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Governance</p>
              <Field label="Purpose"       value={cam.purpose} />
              <Field label="Process owner" value={cam.processOwner} />
              {(cam.activeFrom || cam.activeTo) && (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  <span>{cam.activeFrom ?? '—'} – {cam.activeTo ?? '—'}</span>
                </div>
              )}
              {cam.streamUrl && (
                <div className="flex items-start gap-2 text-sm">
                  <Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span className="truncate text-slate-400">{cam.streamUrl}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Location breadcrumb ── */}
          <Card className="border-slate-800 bg-slate-900/50">
            <CardContent className="p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Location</p>
              {!zone && !room ? (
                <p className="text-sm text-amber-400">⚠ No location assigned — edit this camera to map it to a zone or room.</p>
              ) : (
                <div className="space-y-2">
                  {site && (
                    <div className="flex items-center gap-2">
                      <School className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <span className="text-xs text-slate-400">Site</span>
                      <span className="text-sm text-slate-200">{String(site.name)}</span>
                    </div>
                  )}
                  {building && (
                    <div className="flex items-center gap-2 pl-4">
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                      <span className="text-xs text-slate-400">Building</span>
                      <span className="text-sm text-slate-200">{String(building.name)}</span>
                    </div>
                  )}
                  {floor && (
                    <div className="flex items-center gap-2 pl-8">
                      <Layers className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                      <span className="text-xs text-slate-400">Floor</span>
                      <span className="text-sm text-slate-200">{String(floor.name)} (Level {String(floor.levelNo)})</span>
                    </div>
                  )}
                  {zone && (
                    <div className="flex items-center gap-2 pl-12">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                      <span className="text-xs text-slate-400">Zone</span>
                      <span className="text-sm text-slate-200">{String(zone.name)}</span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">{String(zone.zoneType ?? '')}</span>
                    </div>
                  )}
                  {room && (
                    <div className="flex items-center gap-2 pl-16">
                      <DoorOpen className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                      <span className="text-xs text-slate-400">Room</span>
                      <span className="font-mono text-xs text-slate-400">{String(room.roomCode)}</span>
                      <span className="text-sm text-slate-200">{String(room.roomName)}</span>
                      {room.capacity != null && (
                        <span className="text-[10px] text-slate-500">{String(room.capacity)} seats</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      )}
    </div>
  );
}
