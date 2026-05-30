'use client';

import { useMemo, useState, useCallback, useEffect, type ReactNode, type ComponentType } from 'react';
import {
  School,
  Building2,
  Layers,
  MapPin,
  DoorOpen,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Maximize2,
  Minimize2,
  List,
  LayoutGrid,
  Search,
  X,
  GraduationCap,
  Users,
  FileDown,
  Loader2,
} from 'lucide-react';
import { downloadCampusTreePdf } from '@/lib/school-management/campus-tree-export';

type Row = Record<string, unknown>;
type ViewMode = 'explorer' | 'outline';

const LEVELS = [
  { key: 'site', label: 'Site', icon: School, accent: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40' },
  { key: 'building', label: 'Building', icon: Building2, accent: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/40' },
  { key: 'floor', label: 'Floor', icon: Layers, accent: 'text-indigo-400', bg: 'bg-indigo-500/15', border: 'border-indigo-500/40' },
  { key: 'zone', label: 'Zone', icon: MapPin, accent: 'text-violet-400', bg: 'bg-violet-500/15', border: 'border-violet-500/40' },
  { key: 'room', label: 'Room', icon: DoorOpen, accent: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/40' },
] as const;

function zoneTypeStyle(zoneType: string): string {
  const t = zoneType.toLowerCase();
  if (t.includes('classroom') || t.includes('lab') || t.includes('library')) {
    return 'bg-sky-500/15 text-sky-300 ring-sky-500/25';
  }
  if (t.includes('restricted') || t.includes('server') || t.includes('fire')) {
    return 'bg-rose-500/15 text-rose-300 ring-rose-500/25';
  }
  if (t.includes('bus') || t.includes('gate') || t.includes('parking') || t.includes('playground')) {
    return 'bg-amber-500/15 text-amber-300 ring-amber-500/25';
  }
  if (t.includes('corridor') || t.includes('stair')) {
    return 'bg-violet-500/15 text-violet-300 ring-violet-500/25';
  }
  return 'bg-slate-500/15 text-slate-400 ring-slate-500/20';
}

function matchesSearch(text: string, q: string): boolean {
  return text.toLowerCase().includes(q);
}

function rowMatches(row: Row, q: string, extra?: string[]): boolean {
  const parts = [
    String(row.name ?? ''),
    String(row.address ?? ''),
    String(row.roomCode ?? ''),
    String(row.roomName ?? ''),
    String(row.zoneType ?? ''),
    ...(extra ?? []),
  ];
  return parts.some((p) => matchesSearch(p, q));
}

function HierarchyPipeline({ counts }: { counts: Record<string, number> }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-3 sm:px-4">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-slate-500">
        How campus data is organized
      </p>
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {LEVELS.map((level, i) => {
          const Icon = level.icon;
          const count = counts[level.key] ?? 0;
          return (
            <div key={level.key} className="flex items-center gap-1.5 sm:gap-2">
              <div
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 sm:px-3 ${level.bg} ${level.border}`}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${level.accent}`} />
                <div>
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${level.accent}`}>
                    {level.label}
                  </p>
                  <p className="text-xs font-medium tabular-nums text-slate-200">{count}</p>
                </div>
              </div>
              {i < LEVELS.length - 1 && (
                <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-600 sm:block" aria-hidden />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        Each room belongs to a zone on a floor inside a building at your school site. Use{' '}
        <span className="text-slate-400">Explorer</span> to drill down column by column, or{' '}
        <span className="text-slate-400">Outline</span> to see the full nested tree.
      </p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="flex min-w-[7rem] flex-1 items-center gap-3 rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2.5">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-lg font-semibold tabular-nums leading-none text-slate-100">{value}</p>
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900/80 p-0.5">
      <button
        type="button"
        onClick={() => onChange('explorer')}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === 'explorer'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Explorer
      </button>
      <button
        type="button"
        onClick={() => onChange('outline')}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === 'outline'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <List className="h-3.5 w-3.5" />
        Outline
      </button>
    </div>
  );
}

function BreadcrumbTrail({
  crumbs,
  onNavigate,
}: {
  crumbs: { label: string; level: 'site' | 'building' | 'floor' | 'zone' }[];
  onNavigate: (index: number) => void;
}) {
  if (!crumbs.length) return null;
  return (
    <nav className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs" aria-label="Campus path">
      {crumbs.map((c, i) => (
        <span key={`${c.level}-${i}`} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-slate-600" />}
          <button
            type="button"
            onClick={() => onNavigate(i)}
            className={`max-w-[10rem] truncate rounded px-1 py-0.5 transition-colors hover:bg-slate-800 ${
              i === crumbs.length - 1 ? 'font-medium text-slate-100' : 'text-slate-400 hover:text-slate-200'
            }`}
            title={c.label}
          >
            {c.label}
          </button>
        </span>
      ))}
    </nav>
  );
}

function ExplorerItem({
  label,
  sublabel,
  selected,
  onClick,
  icon: Icon,
  iconClass,
  highlight,
}: {
  label: string;
  sublabel?: string;
  selected: boolean;
  onClick: () => void;
  icon: ComponentType<{ className?: string }>;
  iconClass: string;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-2 border-b border-slate-800/80 px-3 py-2.5 text-left transition-colors last:border-b-0 ${
        selected
          ? 'bg-blue-600/15 ring-1 ring-inset ring-blue-500/40'
          : highlight
            ? 'bg-amber-500/5 hover:bg-slate-800/60'
            : 'hover:bg-slate-800/50'
      }`}
    >
      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded ${iconClass}`}>
        <Icon className="h-3 w-3" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${selected ? 'font-medium text-slate-100' : 'text-slate-300'}`}>{label}</p>
        {sublabel && <p className="truncate text-[10px] text-slate-500">{sublabel}</p>}
      </div>
      <ChevronRight className={`mt-1 h-3.5 w-3.5 shrink-0 ${selected ? 'text-blue-400' : 'text-slate-600'}`} />
    </button>
  );
}

function ExplorerColumn({
  title,
  levelIcon: Icon,
  levelAccent,
  children,
  emptyHint,
  isEmpty,
}: {
  title: string;
  levelIcon: ComponentType<{ className?: string }>;
  levelAccent: string;
  children?: ReactNode;
  emptyHint: string;
  isEmpty?: boolean;
}) {
  return (
    <div className="flex min-h-[280px] min-w-0 flex-1 flex-col border-slate-800 bg-slate-950/40 sm:min-h-[360px] sm:border-r last:sm:border-r-0">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-900/80 px-3 py-2">
        <Icon className={`h-3.5 w-3.5 ${levelAccent}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{title}</span>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {isEmpty ? (
          <p className="px-3 py-6 text-center text-[11px] leading-relaxed text-slate-600">{emptyHint}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function RoomChip({
  code,
  name,
  capacity,
  inactive,
  compact,
}: {
  code: string;
  name: string;
  capacity: string;
  inactive?: boolean;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 rounded-md border px-2 py-2 text-xs ${
          inactive ? 'border-red-500/20 bg-red-500/5 opacity-70' : 'border-slate-700/80 bg-slate-800/40'
        }`}
      >
        <DoorOpen className="h-3 w-3 shrink-0 text-cyan-500/70" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[10px] text-slate-500">{code}</p>
          <p className="truncate text-slate-300">{name}</p>
        </div>
        <span className="shrink-0 text-[10px] tabular-nums text-slate-500">{capacity}</span>
      </div>
    );
  }
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
        inactive
          ? 'border-red-500/20 bg-red-500/5 text-slate-500'
          : 'border-slate-700/80 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
      }`}
    >
      <DoorOpen className="h-3 w-3 shrink-0 text-slate-500" />
      <span className="font-mono text-[11px] text-slate-400">{code}</span>
      <span className="text-slate-300">{name}</span>
      <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-500">
        {capacity} seats
      </span>
      {inactive && (
        <span className="rounded bg-red-500/15 px-1 py-0.5 text-[10px] font-medium text-red-400">inactive</span>
      )}
    </div>
  );
}

// ─── Explorer (column drill-down) ───────────────────────────────────────────

function CampusExplorer({
  sites,
  buildings,
  floors,
  zones,
  rooms,
  sections,
  sectionMappings,
  search,
}: {
  sites: Row[];
  buildings: Row[];
  floors: Row[];
  zones: Row[];
  rooms: Row[];
  sections: Row[];
  sectionMappings: SectionMapping[];
  search: string;
}) {
  const q = search.trim().toLowerCase();

  const [siteId, setSiteId] = useState<number | null>(null);
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [floorId, setFloorId] = useState<number | null>(null);
  const [zoneId, setZoneId] = useState<number | null>(null);

  // Auto-select site when there's only one
  useEffect(() => {
    if (sites.length === 1 && siteId === null) {
      setSiteId(Number(sites[0].id));
    }
  }, [sites, siteId]);

  // Auto-select building when site is selected and has only one building
  useEffect(() => {
    if (siteId == null) return;
    const siteBuilds = buildings.filter((b) => Number(b.siteId) === siteId);
    if (siteBuilds.length === 1 && buildingId === null) {
      setBuildingId(Number(siteBuilds[0].id));
    }
  }, [siteId, buildings, buildingId]);

  const filteredSites = useMemo(() => {
    if (!q) return sites;
    return sites.filter((s) => {
      if (rowMatches(s, q)) return true;
      const siteB = buildings.filter((b) => Number(b.siteId) === Number(s.id));
      return siteB.some((b) =>
        rowMatches(b, q) ||
        floors.filter((f) => Number(f.buildingId) === Number(b.id)).some((f) =>
          rowMatches(f, q) ||
          zones.filter((z) => Number(z.floorId) === Number(f.id)).some((z) =>
            rowMatches(z, q) ||
            rooms.filter((r) => Number(r.zoneId) === Number(z.id)).some((r) => rowMatches(r, q)),
          ),
        ),
      );
    });
  }, [sites, buildings, floors, zones, rooms, q]);

  const siteBuildings = useMemo(() => {
    if (siteId == null) return [];
    let list = buildings.filter((b) => Number(b.siteId) === siteId);
    if (q) list = list.filter((b) => rowMatches(b, q) || floors.some((f) => Number(f.buildingId) === Number(b.id) && rowMatches(f, q)));
    return list;
  }, [buildings, siteId, floors, q]);

  const buildingFloors = useMemo(() => {
    if (buildingId == null) return [];
    let list = floors.filter((f) => Number(f.buildingId) === buildingId).sort((a, b) => Number(a.levelNo) - Number(b.levelNo));
    if (q) list = list.filter((f) => rowMatches(f, q) || zones.some((z) => Number(z.floorId) === Number(f.id) && rowMatches(z, q)));
    return list;
  }, [floors, buildingId, zones, q]);

  const floorZones = useMemo(() => {
    if (floorId == null) return [];
    let list = zones.filter((z) => Number(z.floorId) === floorId);
    if (q) list = list.filter((z) => rowMatches(z, q) || rooms.some((r) => Number(r.zoneId) === Number(z.id) && rowMatches(r, q)));
    return list;
  }, [zones, floorId, rooms, q]);

  const zoneRooms = useMemo(() => {
    if (zoneId == null) return [];
    let list = rooms.filter((r) => Number(r.zoneId) === zoneId);
    if (q) list = list.filter((r) => rowMatches(r, q));
    return list;
  }, [rooms, zoneId, q]);

  const selectedSite = sites.find((s) => s.id === siteId);
  const selectedBuilding = buildings.find((b) => Number(b.id) === buildingId);
  const selectedFloor = floors.find((f) => Number(f.id) === floorId);
  const selectedZone = zones.find((z) => Number(z.id) === zoneId);

  const crumbs = useMemo(() => {
    const c: { label: string; level: 'site' | 'building' | 'floor' | 'zone' }[] = [];
    if (selectedSite) c.push({ label: String(selectedSite.name), level: 'site' });
    if (selectedBuilding) c.push({ label: String(selectedBuilding.name), level: 'building' });
    if (selectedFloor) c.push({ label: String(selectedFloor.name), level: 'floor' });
    if (selectedZone) c.push({ label: String(selectedZone.name), level: 'zone' });
    return c;
  }, [selectedSite, selectedBuilding, selectedFloor, selectedZone]);

  const navigateCrumb = (index: number) => {
    if (index < 0) return;
    if (index === 0) {
      setBuildingId(null);
      setFloorId(null);
      setZoneId(null);
    } else if (index === 1) {
      setFloorId(null);
      setZoneId(null);
    } else if (index === 2) {
      setZoneId(null);
    }
  };

  const itemHighlight = (label: string) => q.length > 0 && matchesSearch(label, q);

  return (
    <div className="space-y-3">
      <BreadcrumbTrail crumbs={crumbs} onNavigate={navigateCrumb} />

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950">
        <div className="flex min-w-[640px]">
          <ExplorerColumn
            title="1 · Site"
            levelIcon={School}
            levelAccent="text-emerald-400"
            emptyHint={q ? 'No sites match search' : 'No sites'}
            isEmpty={filteredSites.length === 0}
          >
            {filteredSites.map((site) => (
              <ExplorerItem
                key={String(site.id)}
                label={String(site.name)}
                sublabel={site.address ? String(site.address) : undefined}
                selected={siteId === Number(site.id)}
                highlight={itemHighlight(String(site.name))}
                icon={School}
                iconClass="bg-emerald-500/20 text-emerald-400"
                onClick={() => {
                  setSiteId(Number(site.id));
                  setBuildingId(null);
                  setFloorId(null);
                  setZoneId(null);
                }}
              />
            ))}
          </ExplorerColumn>

          <ExplorerColumn
            title="2 · Building"
            levelIcon={Building2}
            levelAccent="text-blue-400"
            emptyHint={siteId == null ? 'Select a site ←' : 'No buildings on this site'}
            isEmpty={siteId == null || siteBuildings.length === 0}
          >
            {siteBuildings.map((bld) => (
                <ExplorerItem
                  key={String(bld.id)}
                  label={String(bld.name)}
                  sublabel={`${floors.filter((f) => f.buildingId === bld.id).length} floor(s)`}
                  selected={buildingId === Number(bld.id)}
                  highlight={itemHighlight(String(bld.name))}
                  icon={Building2}
                  iconClass="bg-blue-500/20 text-blue-400"
                  onClick={() => {
                    setBuildingId(Number(bld.id));
                    setFloorId(null);
                    setZoneId(null);
                  }}
                />
            ))}
          </ExplorerColumn>

          <ExplorerColumn
            title="3 · Floor"
            levelIcon={Layers}
            levelAccent="text-indigo-400"
            emptyHint={buildingId == null ? 'Select a building ←' : 'No floors in this building'}
            isEmpty={buildingId == null || buildingFloors.length === 0}
          >
            {buildingFloors.map((flr) => {
                const zc = zones.filter((z) => z.floorId === flr.id).length;
                const rc = rooms.filter((r) => zones.some((z) => Number(z.floorId) === Number(flr.id) && Number(z.id) === Number(r.zoneId))).length;
                return (
                  <ExplorerItem
                    key={String(flr.id)}
                    label={String(flr.name)}
                    sublabel={`Level ${flr.levelNo} · ${zc} zones · ${rc} rooms`}
                    selected={floorId === Number(flr.id)}
                    highlight={itemHighlight(String(flr.name))}
                    icon={Layers}
                    iconClass="bg-indigo-500/20 text-indigo-400"
                    onClick={() => {
                      setFloorId(Number(flr.id));
                      setZoneId(null);
                    }}
                  />
                );
            })}
          </ExplorerColumn>

          <ExplorerColumn
            title="4 · Zone"
            levelIcon={MapPin}
            levelAccent="text-violet-400"
            emptyHint={floorId == null ? 'Select a floor ←' : 'No zones on this floor'}
            isEmpty={floorId == null || floorZones.length === 0}
          >
            {floorZones.map((zone) => {
                const zt = String(zone.zoneType ?? 'General');
                const rc = rooms.filter((r) => r.zoneId === zone.id).length;
                return (
                  <ExplorerItem
                    key={String(zone.id)}
                    label={String(zone.name)}
                    sublabel={`${zt}${zone.isRiskZone ? ' · risk' : ''} · ${rc} room(s)`}
                    selected={zoneId === Number(zone.id)}
                    highlight={itemHighlight(String(zone.name))}
                    icon={MapPin}
                    iconClass="bg-violet-500/20 text-violet-400"
                    onClick={() => setZoneId(Number(zone.id))}
                  />
                );
            })}
          </ExplorerColumn>

          <ExplorerColumn
            title="5 · Rooms"
            levelIcon={DoorOpen}
            levelAccent="text-cyan-400"
            emptyHint={zoneId == null ? 'Select a zone ←' : 'No rooms in this zone'}
            isEmpty={zoneId == null || zoneRooms.length === 0}
          >
            {zoneId != null && zoneRooms.length > 0 && (
              <div className="space-y-1.5 p-2">
                {selectedZone && (
                  <div className="mb-2 rounded-lg border border-violet-500/20 bg-violet-500/5 px-2.5 py-2">
                    <p className="text-xs font-medium text-slate-200">{String(selectedZone.name)}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 text-[10px] ring-1 ring-inset ${zoneTypeStyle(String(selectedZone.zoneType ?? ''))}`}
                      >
                        {String(selectedZone.zoneType)}
                      </span>
                      {Boolean(selectedZone.isRiskZone) && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {String(selectedZone.riskCategory ?? 'Risk')}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {zoneRooms.map((room) => {
                  const m = sectionMappings.find((x) => x.roomId === Number(room.id));
                  const sec = m ? sections.find((s) => Number(s.id) === m.sectionId) : null;
                  return (
                    <div key={String(room.id)}>
                      <RoomChip
                        code={String(room.roomCode)}
                        name={String(room.roomName)}
                        capacity={String(room.capacity)}
                        inactive={room.isActive === false}
                        compact
                      />
                      {sec && (
                        <div className="mt-0.5 ml-1 flex items-center gap-1">
                          <Users className="h-2.5 w-2.5 text-amber-400/70" />
                          <span className="text-[10px] text-amber-300/80">{String(sec.name)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ExplorerColumn>
        </div>
      </div>
    </div>
  );
}

// ─── Outline (nested tree) ───────────────────────────────────────────────────

function TreeToggle({
  open,
  onToggle,
  hasChildren,
}: {
  open: boolean;
  onToggle: () => void;
  hasChildren: boolean;
}) {
  if (!hasChildren) return <span className="inline-block h-5 w-5 shrink-0" aria-hidden />;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
      aria-expanded={open}
    >
      {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
    </button>
  );
}

function TreeBranch({ children }: { children: ReactNode }) {
  return <div className="relative ml-3 border-l border-slate-700/60 pl-4 pb-1">{children}</div>;
}

function TreeNode({
  id,
  collapsed,
  onToggle,
  hasChildren,
  icon: Icon,
  iconClass,
  title,
  meta,
  badges,
  accentBar,
  children,
  size = 'md',
  dimmed,
}: {
  id: string;
  collapsed: boolean;
  onToggle: (id: string) => void;
  hasChildren: boolean;
  icon: ComponentType<{ className?: string }>;
  iconClass: string;
  title: string;
  meta?: ReactNode;
  badges?: ReactNode;
  accentBar?: string;
  children?: ReactNode;
  size?: 'lg' | 'md' | 'sm';
  dimmed?: boolean;
}) {
  const open = !collapsed;
  const titleCls =
    size === 'lg'
      ? 'text-sm font-semibold text-slate-100'
      : size === 'md'
        ? 'text-sm font-medium text-slate-200'
        : 'text-xs font-medium text-slate-300';

  return (
    <div className={`py-0.5 transition-opacity ${dimmed ? 'opacity-35' : ''}`}>
      <div
        className={`flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-800/40 ${
          accentBar ? `border-l-2 ${accentBar} pl-2.5` : ''
        }`}
      >
        <TreeToggle open={open} onToggle={() => onToggle(id)} hasChildren={hasChildren} />
        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${iconClass}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={titleCls}>{title}</span>
            {meta}
            {badges}
          </div>
        </div>
      </div>
      {hasChildren && open && children ? <TreeBranch>{children}</TreeBranch> : null}
    </div>
  );
}

function CampusOutline({
  sites,
  buildings,
  floors,
  zones,
  rooms,
  sections,
  sectionMappings,
  search,
}: {
  sites: Row[];
  buildings: Row[];
  floors: Row[];
  zones: Row[];
  rooms: Row[];
  sections: Row[];
  sectionMappings: SectionMapping[];
  search: string;
}) {
  const q = search.trim().toLowerCase();

  const visibleKeys = useMemo(() => {
    if (!q) return null;
    const vis = new Set<string>();
    const markAncestors = (keys: string[]) => keys.forEach((k) => vis.add(k));

    for (const site of sites) {
      const sk = `site-${site.id}`;
      let siteHit = rowMatches(site, q);
      for (const bld of buildings.filter((b) => Number(b.siteId) === Number(site.id))) {
        const bk = `bld-${bld.id}`;
        let bHit = rowMatches(bld, q);
        for (const flr of floors.filter((f) => f.buildingId === bld.id)) {
          const fk = `flr-${flr.id}`;
          let fHit = rowMatches(flr, q);
          for (const zone of zones.filter((z) => z.floorId === flr.id)) {
            const zk = `zone-${zone.id}`;
            const zHit = rowMatches(zone, q);
            const zoneRooms = rooms.filter((r) => r.zoneId === zone.id);
            const rHit = zoneRooms.some((r) => rowMatches(r, q));
            if (zHit || rHit) {
              markAncestors([sk, bk, fk, zk]);
              zoneRooms.forEach((r) => {
                if (rowMatches(r, q)) vis.add(`room-${r.id}`);
              });
            }
            if (zHit) fHit = true;
            if (rHit) fHit = true;
          }
          if (fHit) {
            markAncestors([sk, bk, fk]);
            bHit = true;
          }
        }
        if (bHit) {
          markAncestors([sk, bk]);
          siteHit = true;
        }
      }
      if (siteHit) vis.add(sk);
    }
    return vis;
  }, [sites, buildings, floors, zones, rooms, q]);

  const isVisible = (key: string) => !visibleKeys || visibleKeys.has(key);

  const treeKeys = useMemo(() => {
    const keys: string[] = [];
    for (const site of sites) {
      keys.push(`site-${site.id}`);
      for (const bld of buildings.filter((b) => Number(b.siteId) === Number(site.id))) {
        keys.push(`bld-${bld.id}`);
        for (const flr of floors.filter((f) => f.buildingId === bld.id)) {
          keys.push(`flr-${flr.id}`);
          for (const zone of zones.filter((z) => z.floorId === flr.id)) {
            keys.push(`zone-${zone.id}`);
          }
        }
      }
    }
    return keys;
  }, [sites, buildings, floors, zones]);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const isCollapsed = useCallback((id: string) => collapsed.has(id), [collapsed]);
  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (q && visibleKeys) setCollapsed(new Set());
  }, [q, visibleKeys]);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950/90 p-4 sm:p-5">
      <div className="mb-3 flex gap-1.5">
        <button
          type="button"
          onClick={() => setCollapsed(new Set())}
          className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
        >
          <Maximize2 className="h-3 w-3" /> Expand all
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(new Set(treeKeys))}
          className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
        >
          <Minimize2 className="h-3 w-3" /> Collapse all
        </button>
      </div>

      {sites.map((site) => {
        const siteKey = `site-${site.id}`;
        if (!isVisible(siteKey)) return null;
        const siteBuildings = buildings.filter((b) => Number(b.siteId) === Number(site.id));
        return (
          <div key={siteKey} className="mb-6 last:mb-0">
            <TreeNode
              id={siteKey}
              collapsed={isCollapsed(siteKey)}
              onToggle={toggle}
              hasChildren={siteBuildings.length > 0}
              icon={School}
              iconClass="bg-emerald-500/20 text-emerald-400"
              accentBar="border-emerald-500/60"
              title={String(site.name)}
              size="lg"
              dimmed={!!visibleKeys && !visibleKeys.has(siteKey)}
              meta={site.address ? <span className="text-xs text-slate-500">{String(site.address)}</span> : undefined}
            >
              {siteBuildings.map((bld) => {
                const bldKey = `bld-${bld.id}`;
                if (!isVisible(bldKey)) return null;
                const bldFloors = floors.filter((f) => f.buildingId === bld.id);
                return (
                  <TreeNode
                    key={bldKey}
                    id={bldKey}
                    collapsed={isCollapsed(bldKey)}
                    onToggle={toggle}
                    hasChildren={bldFloors.length > 0}
                    icon={Building2}
                    iconClass="bg-blue-500/20 text-blue-400"
                    accentBar="border-blue-500/50"
                    title={String(bld.name)}
                    meta={
                      <span className="text-[10px] text-slate-600">
                        {bldFloors.length} floor{bldFloors.length === 1 ? '' : 's'}
                      </span>
                    }
                  >
                    {bldFloors.map((flr) => {
                      const flrKey = `flr-${flr.id}`;
                      if (!isVisible(flrKey)) return null;
                      const flrZones = zones.filter((z) => z.floorId === flr.id);
                      const flrRooms = rooms.filter((r) => flrZones.some((z) => Number(z.id) === Number(r.zoneId)));
                      return (
                        <TreeNode
                          key={flrKey}
                          id={flrKey}
                          collapsed={isCollapsed(flrKey)}
                          onToggle={toggle}
                          hasChildren={flrZones.length > 0}
                          icon={Layers}
                          iconClass="bg-indigo-500/20 text-indigo-400"
                          title={String(flr.name)}
                          meta={
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">
                              Level {String(flr.levelNo)}
                            </span>
                          }
                          badges={
                            flrRooms.length > 0 ? (
                              <span className="text-[10px] text-slate-600">
                                {flrRooms.length} room{flrRooms.length === 1 ? '' : 's'}
                              </span>
                            ) : undefined
                          }
                        >
                          {flrZones.map((zone) => {
                            const zoneKey = `zone-${zone.id}`;
                            if (!isVisible(zoneKey)) return null;
                            const zoneRooms = rooms.filter((r) => r.zoneId === zone.id);
                            const zoneType = String(zone.zoneType ?? 'General');
                            return (
                              <TreeNode
                                key={zoneKey}
                                id={zoneKey}
                                collapsed={isCollapsed(zoneKey)}
                                onToggle={toggle}
                                hasChildren={zoneRooms.length > 0}
                                icon={MapPin}
                                iconClass="bg-violet-500/20 text-violet-400"
                                title={String(zone.name)}
                                size="sm"
                                badges={
                                  <>
                                    <span
                                      className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${zoneTypeStyle(zoneType)}`}
                                    >
                                      {zoneType}
                                    </span>
                                    {zone.isRiskZone && (
                                      <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400 ring-1 ring-inset ring-amber-500/25">
                                        <AlertTriangle className="h-2.5 w-2.5" />
                                        {String(zone.riskCategory ?? 'Risk')}
                                      </span>
                                    )}
                                  </>
                                }
                              >
                                {zoneRooms.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 pb-2 pt-0.5">
                                    {zoneRooms.map((room) => {
                                      const m = sectionMappings.find((x) => x.roomId === Number(room.id));
                                      const sec = m ? sections.find((s) => Number(s.id) === m.sectionId) : null;
                                      return (
                                        <div key={String(room.id)} className="flex flex-col gap-0.5">
                                          <RoomChip
                                            code={String(room.roomCode)}
                                            name={String(room.roomName)}
                                            capacity={String(room.capacity)}
                                            inactive={room.isActive === false}
                                          />
                                          {sec && (
                                            <div className="flex items-center gap-1 pl-1">
                                              <Users className="h-2.5 w-2.5 text-amber-400/70" />
                                              <span className="text-[10px] text-amber-300/80">{String(sec.name)}</span>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </TreeNode>
                            );
                          })}
                        </TreeNode>
                      );
                    })}
                  </TreeNode>
                );
              })}
            </TreeNode>
          </div>
        );
      })}

      {q && visibleKeys?.size === 0 && (
        <p className="py-8 text-center text-sm text-slate-500">No matches for &quot;{search}&quot;</p>
      )}
    </div>
  );
}

// ─── Assignments panel ──────────────────────────────────────────────────────

type SectionMapping = { sectionId: number; roomId: number; isPrimary?: boolean };

function AssignmentsPanel({
  classes,
  sections,
  sectionMappings,
  rooms,
}: {
  classes: Row[];
  sections: Row[];
  sectionMappings: SectionMapping[];
  rooms: Row[];
}) {
  const [open, setOpen] = useState(false);

  const mappedCount = sectionMappings.length;
  const totalSections = sections.length;

  if (!classes.length && !sections.length) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-medium text-slate-200">Academic Assignments</span>
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
            {mappedCount}/{totalSections} sections assigned
          </span>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-500" />
        )}
      </button>

      {open && (
        <div className="border-t border-slate-800 px-4 pb-4 pt-3">
          {classes.length === 0 ? (
            <p className="text-xs text-slate-500">No classes found. Add classes in the Classes & Sections tab.</p>
          ) : (
            <div className="space-y-3">
              {classes.map((cls) => {
                const clsSections = sections.filter((s) => Number(s.classId) === Number(cls.id));
                return (
                  <div key={String(cls.id)}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <GraduationCap className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <span className="text-xs font-semibold text-slate-200">{String(cls.name)}</span>
                      <span className="text-[10px] text-slate-500">{clsSections.length} section{clsSections.length !== 1 ? 's' : ''}</span>
                    </div>
                    {clsSections.length === 0 ? (
                      <p className="ml-5 text-[11px] text-slate-600">No sections</p>
                    ) : (
                      <div className="ml-5 flex flex-wrap gap-1.5">
                        {clsSections.map((sec) => {
                          const mapping = sectionMappings.find((m) => m.sectionId === Number(sec.id));
                          const room = mapping ? rooms.find((r) => Number(r.id) === mapping.roomId) : null;
                          return (
                            <div
                              key={String(sec.id)}
                              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${
                                room
                                  ? 'border-cyan-500/30 bg-cyan-500/5 text-slate-300'
                                  : 'border-slate-700/60 bg-slate-800/40 text-slate-500'
                              }`}
                            >
                              <Users className="h-3 w-3 shrink-0 text-slate-500" />
                              <span className="font-medium">{String(sec.name)}</span>
                              {room ? (
                                <span className="flex items-center gap-1">
                                  <ChevronRight className="h-2.5 w-2.5 text-slate-600" />
                                  <DoorOpen className="h-2.5 w-2.5 text-cyan-400" />
                                  <span className="font-mono text-[10px] text-cyan-300">
                                    {String(room.roomCode)}
                                  </span>
                                  <span className="text-slate-400">{String(room.roomName)}</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-600">unassigned</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function CampusTreeView({
  sites,
  buildings,
  floors,
  zones,
  rooms,
  classes = [],
  sections = [],
  sectionMappings = [],
}: {
  sites: Row[];
  buildings: Row[];
  floors: Row[];
  zones: Row[];
  rooms: Row[];
  classes?: Row[];
  sections?: Row[];
  sectionMappings?: SectionMapping[];
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('explorer');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportInput = useMemo(
    () => ({ sites, buildings, floors, zones, rooms, classes, sections, sectionMappings }),
    [sites, buildings, floors, zones, rooms, classes, sections, sectionMappings],
  );

  const handleExportPdf = useCallback(async () => {
    setExportError(null);
    setExporting(true);
    try {
      await downloadCampusTreePdf(exportInput);
    } catch (e) {
      setExportError((e as Error).message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [exportInput]);

  const counts = useMemo(
    () => ({
      site: sites.length,
      building: buildings.length,
      floor: floors.length,
      zone: zones.length,
      room: rooms.length,
    }),
    [sites, buildings, floors, zones, rooms],
  );

  if (!sites.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/80 bg-slate-900/30 px-6 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/80">
          <School className="h-7 w-7 text-slate-500" />
        </div>
        <p className="text-sm font-medium text-slate-300">No campus data yet</p>
        <p className="mt-1 max-w-sm text-xs text-slate-500">
          Add sites, buildings, floors, zones, and rooms using the tabs above to build your campus hierarchy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <StatCard icon={School} label="Sites" value={sites.length} accent="bg-emerald-500/15 text-emerald-400" />
        <StatCard icon={Building2} label="Buildings" value={buildings.length} accent="bg-blue-500/15 text-blue-400" />
        <StatCard icon={Layers} label="Floors" value={floors.length} accent="bg-indigo-500/15 text-indigo-400" />
        <StatCard icon={MapPin} label="Zones" value={zones.length} accent="bg-violet-500/15 text-violet-400" />
        <StatCard icon={DoorOpen} label="Rooms" value={rooms.length} accent="bg-cyan-500/15 text-cyan-400" />
        {classes.length > 0 && <StatCard icon={GraduationCap} label="Classes" value={classes.length} accent="bg-amber-500/15 text-amber-400" />}
        {sections.length > 0 && <StatCard icon={Users} label="Sections" value={sections.length} accent="bg-orange-500/15 text-orange-400" />}
      </div>

      <HierarchyPipeline counts={counts} />

      <AssignmentsPanel
        classes={classes}
        sections={sections}
        sectionMappings={sectionMappings}
        rooms={rooms}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
          <button
            type="button"
            onClick={() => void handleExportPdf()}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            title="Download campus hierarchy as PDF"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            Export PDF
          </button>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search site, zone, room code…"
            className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900 pl-8 pr-8 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {exportError && (
        <p className="text-xs text-red-400" role="alert">
          {exportError}
        </p>
      )}

      {viewMode === 'explorer' ? (
        <CampusExplorer
          sites={sites}
          buildings={buildings}
          floors={floors}
          zones={zones}
          rooms={rooms}
          sections={sections}
          sectionMappings={sectionMappings}
          search={search}
        />
      ) : (
        <CampusOutline
          sites={sites}
          buildings={buildings}
          floors={floors}
          zones={zones}
          rooms={rooms}
          sections={sections}
          sectionMappings={sectionMappings}
          search={search}
        />
      )}
    </div>
  );
}
