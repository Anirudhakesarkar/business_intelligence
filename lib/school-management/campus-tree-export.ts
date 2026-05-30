/** Build a hierarchical text tree and export as PDF (client-side). */

export type CampusRow = Record<string, unknown>;

export type SectionMapping = { sectionId: number; roomId: number; isPrimary?: boolean };

export type CampusTreeExportInput = {
  sites: CampusRow[];
  buildings: CampusRow[];
  floors: CampusRow[];
  zones: CampusRow[];
  rooms: CampusRow[];
  classes?: CampusRow[];
  sections?: CampusRow[];
  sectionMappings?: SectionMapping[];
};

export type TreeLine = {
  indent: number;
  text: string;
  bold?: boolean;
  muted?: boolean;
};

const INDENT_MM = 5.5;
const MARGIN_X = 12;
const MARGIN_TOP = 16;
const LINE_HEIGHT = 4.2;
const PAGE_BOTTOM = 285;

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtActive(isActive: unknown): string {
  if (isActive === false) return ' · inactive';
  return '';
}

function sectionLabel(
  roomId: number,
  sections: CampusRow[],
  classes: CampusRow[],
  sectionMappings: SectionMapping[],
): string | null {
  const m = sectionMappings.find((x) => x.roomId === roomId);
  if (!m) return null;
  const sec = sections.find((s) => Number(s.id) === m.sectionId);
  if (!sec) return null;
  const cls = classes.find((c) => Number(c.id) === Number(sec.classId));
  const clsName = cls ? String(cls.name) : '';
  const secName = String(sec.name);
  return clsName ? `${clsName} / ${secName}` : secName;
}

function resolveRoomPath(room: CampusRow, input: CampusTreeExportInput): string {
  const { sites, buildings, floors, zones } = input;
  const zoneId = num(room.zoneId);
  if (zoneId == null) return 'Unassigned';
  const zone = zones.find((z) => Number(z.id) === zoneId);
  if (!zone) return `Zone #${zoneId} (missing)`;
  const floorId = num(zone.floorId);
  const floor = floorId != null ? floors.find((f) => Number(f.id) === floorId) : null;
  const buildingId = floor ? num(floor.buildingId) : null;
  const building = buildingId != null ? buildings.find((b) => Number(b.id) === buildingId) : null;
  const siteId = building ? num(building.siteId) : null;
  const site = siteId != null ? sites.find((s) => Number(s.id) === siteId) : null;
  const parts = [
    site ? String(site.name) : siteId != null ? `Site #${siteId}` : null,
    building ? String(building.name) : buildingId != null ? `Building #${buildingId}` : null,
    floor ? String(floor.name) : floorId != null ? `Floor #${floorId}` : null,
    String(zone.name),
  ].filter(Boolean);
  return parts.join(' → ') || String(zone.name);
}

function formatRoom(
  room: CampusRow,
  sections: CampusRow[],
  classes: CampusRow[],
  mappings: SectionMapping[],
): string {
  const code = String(room.roomCode ?? '');
  const name = String(room.roomName ?? 'Room');
  const type = room.roomType ? ` · ${room.roomType}` : '';
  const cap = room.capacity != null ? ` · ${room.capacity} seats` : '';
  const inactive = room.isActive === false ? ' · INACTIVE' : '';
  const sec = sectionLabel(Number(room.id), sections, classes, mappings);
  const secPart = sec ? ` · Class/Section: ${sec}` : '';
  return `${code} · ${name}${type}${cap}${secPart}${inactive}`;
}

export function buildCampusTreeLines(input: CampusTreeExportInput): TreeLine[] {
  const {
    sites,
    buildings,
    floors,
    zones,
    rooms,
    classes = [],
    sections = [],
    sectionMappings = [],
  } = input;
  const lines: TreeLine[] = [];

  const placedBuildings = new Set<number>();
  const placedFloors = new Set<number>();
  const placedZones = new Set<number>();
  const placedRooms = new Set<number>();

  const markRoom = (id: number) => placedRooms.add(id);
  const markZone = (id: number) => placedZones.add(id);
  const markFloor = (id: number) => placedFloors.add(id);
  const markBuilding = (id: number) => placedBuildings.add(id);

  for (const site of sites) {
    const siteId = num(site.id);
    let siteTitle = String(site.name ?? 'Site');
    const addr = site.address ? String(site.address) : '';
    if (addr) siteTitle += ` — ${addr}`;
    if (siteId != null) siteTitle += ` (id ${siteId})`;

    lines.push({ indent: 0, text: `SITE: ${siteTitle}`, bold: true });

    const siteBuildings = buildings.filter((b) => num(b.siteId) === siteId);
    for (const bld of siteBuildings) {
      const bldId = num(bld.id)!;
      markBuilding(bldId);
      lines.push({
        indent: 1,
        text: `BUILDING: ${String(bld.name ?? 'Building')} (id ${bldId})${fmtActive(bld.isActive)}`,
        bold: true,
      });

      const bldFloors = floors.filter((f) => num(f.buildingId) === bldId);
      for (const flr of bldFloors) {
        const flrId = num(flr.id)!;
        markFloor(flrId);
        const levelNo = flr.levelNo != null ? ` · level ${flr.levelNo}` : '';
        lines.push({
          indent: 2,
          text: `FLOOR: ${String(flr.name ?? 'Floor')} (id ${flrId})${levelNo}`,
          bold: true,
        });

        const flrZones = zones.filter((z) => num(z.floorId) === flrId);
        for (const zone of flrZones) {
          appendZoneBranch(zone, rooms, sections, classes, sectionMappings, lines, placedRooms, markZone, markRoom);
        }
        if (!flrZones.length) {
          lines.push({ indent: 3, text: '(no zones on this floor)', muted: true });
        }
      }
      if (!bldFloors.length) {
        lines.push({ indent: 2, text: '(no floors in this building)', muted: true });
      }

      const orphanZonesOnBuilding = zones.filter((z) => {
        const zid = num(z.id);
        if (zid == null || placedZones.has(zid)) return false;
        const zFloorId = num(z.floorId);
        if (zFloorId == null) return true;
        const zFloor = floors.find((f) => Number(f.id) === zFloorId);
        return zFloor != null && num(zFloor.buildingId) === bldId && !placedZones.has(zid);
      });
      if (orphanZonesOnBuilding.length) {
        lines.push({ indent: 2, text: 'ZONES (unplaced floor link):', bold: true });
        for (const zone of orphanZonesOnBuilding) {
          appendZoneBranch(zone, rooms, sections, classes, sectionMappings, lines, placedRooms, markZone, markRoom, 3);
        }
      }
    }
    if (!siteBuildings.length) {
      lines.push({ indent: 1, text: '(no buildings at this site)', muted: true });
    }
  }

  const unplacedBuildings = buildings.filter((b) => {
    const id = num(b.id);
    return id != null && !placedBuildings.has(id);
  });
  if (unplacedBuildings.length) {
    lines.push({ indent: 0, text: 'BUILDINGS (no site link)', bold: true });
    for (const bld of unplacedBuildings) {
      const bldId = num(bld.id)!;
      markBuilding(bldId);
      lines.push({ indent: 1, text: `BUILDING: ${String(bld.name)} (id ${bldId})`, bold: true });
      for (const flr of floors.filter((f) => num(f.buildingId) === bldId)) {
        const flrId = num(flr.id)!;
        if (placedFloors.has(flrId)) continue;
        markFloor(flrId);
        lines.push({ indent: 2, text: `FLOOR: ${String(flr.name)} (id ${flrId})`, bold: true });
        for (const zone of zones.filter((z) => num(z.floorId) === flrId)) {
          appendZoneBranch(zone, rooms, sections, classes, sectionMappings, lines, placedRooms, markZone, markRoom);
        }
      }
    }
  }

  const unplacedZones = zones.filter((z) => {
    const id = num(z.id);
    return id != null && !placedZones.has(id);
  });
  if (unplacedZones.length) {
    lines.push({ indent: 0, text: 'ZONES (not in tree above)', bold: true });
    for (const zone of unplacedZones) {
      appendZoneBranch(zone, rooms, sections, classes, sectionMappings, lines, placedRooms, markZone, markRoom, 1);
    }
  }

  const unplacedRooms = rooms.filter((r) => {
    const id = num(r.id);
    return id != null && !placedRooms.has(id);
  });
  if (unplacedRooms.length) {
    lines.push({ indent: 0, text: 'ROOMS (not in tree above)', bold: true });
    for (const room of unplacedRooms) {
      const rid = num(room.id)!;
      markRoom(rid);
      lines.push({
        indent: 1,
        text: `ROOM: ${formatRoom(room, sections, classes, sectionMappings)} (id ${rid}) · path: ${resolveRoomPath(room, input)}`,
      });
    }
  }

  return lines;
}

function appendZoneBranch(
  zone: CampusRow,
  rooms: CampusRow[],
  sections: CampusRow[],
  classes: CampusRow[],
  sectionMappings: SectionMapping[],
  lines: TreeLine[],
  placedRooms: Set<number>,
  markZone: (id: number) => void,
  markRoom: (id: number) => void,
  indent = 3,
) {
  const zoneId = num(zone.id);
  if (zoneId == null) return;
  markZone(zoneId);

  const zoneType = String(zone.zoneType ?? 'General');
  let zoneLine = `ZONE: ${String(zone.name ?? 'Zone')} (id ${zoneId}) [${zoneType}]`;
  if (zone.isRiskZone) zoneLine += ` · Risk: ${String(zone.riskCategory ?? 'Yes')}`;
  if (zone.capacity != null) zoneLine += ` · capacity ${zone.capacity}`;

  lines.push({ indent, text: zoneLine });

  const zoneRooms = rooms.filter((r) => num(r.zoneId) === zoneId);
  for (const room of zoneRooms) {
    const rid = num(room.id);
    if (rid != null) markRoom(rid);
    lines.push({
      indent: indent + 1,
      text: `ROOM: ${formatRoom(room, sections, classes, sectionMappings)}${rid != null ? ` (id ${rid})` : ''}`,
    });
  }
  if (!zoneRooms.length) {
    lines.push({ indent: indent + 1, text: '(no rooms in this zone)', muted: true });
  }
}

export function campusTreeSummary(input: CampusTreeExportInput) {
  return {
    sites: input.sites.length,
    buildings: input.buildings.length,
    floors: input.floors.length,
    zones: input.zones.length,
    rooms: input.rooms.length,
  };
}

/** Generate and download campus structure PDF (browser only). */
export async function downloadCampusTreePdf(input: CampusTreeExportInput): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const summary = campusTreeSummary(input);
  const treeLines = buildCampusTreeLines(input);
  const generatedAt = new Date().toLocaleString();
  const siteName = input.sites[0]?.name != null ? String(input.sites[0].name) : 'Campus';

  let y = MARGIN_TOP;
  let pageNum = 1;

  const footer = () => {
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Page ${pageNum}`, 210 - MARGIN_X, 290, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_BOTTOM) {
      footer();
      doc.addPage();
      pageNum += 1;
      y = MARGIN_TOP;
    }
  };

  const writeLine = (text: string, indent: number, opts?: { bold?: boolean; size?: number; muted?: boolean }) => {
    if (!text) {
      y += LINE_HEIGHT;
      return;
    }
    const size = opts?.size ?? (opts?.bold ? 9.5 : opts?.muted ? 7.5 : 8.5);
    doc.setFontSize(size);
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    if (opts?.muted) doc.setTextColor(90, 90, 90);
    const x = MARGIN_X + indent * INDENT_MM;
    const maxW = 210 - MARGIN_X - indent * INDENT_MM - 8;
    const wrapped = doc.splitTextToSize(text, maxW) as string[];
    ensureSpace(wrapped.length * LINE_HEIGHT + 0.5);
    doc.text(wrapped, x, y);
    y += wrapped.length * LINE_HEIGHT + 0.3;
    if (opts?.muted) doc.setTextColor(0, 0, 0);
  };

  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('Campus Infrastructure — Full Structure', MARGIN_X, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(siteName, MARGIN_X, y);
  y += 6;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text(`Generated: ${generatedAt}`, MARGIN_X, y);
  y += 4;
  doc.text(
    `Totals: ${summary.sites} site · ${summary.buildings} buildings · ${summary.floors} floors · ${summary.zones} zones · ${summary.rooms} rooms`,
    MARGIN_X,
    y,
  );
  y += 4;
  doc.text('Hierarchy: Site → Building → Floor → Zone → Room', MARGIN_X, y);
  y += 7;
  doc.setTextColor(0, 0, 0);

  writeLine('── HIERARCHY ──', 0, { bold: true, size: 10 });
  y += 1;

  for (const line of treeLines) {
    writeLine(line.text, line.indent, { bold: line.bold, muted: line.muted });
  }

  if (!treeLines.length) {
    writeLine('No campus data to export.', 0);
  }

  footer();

  const siteSlug =
    input.sites[0]?.name != null
      ? String(input.sites[0].name)
          .replace(/[^\w\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-')
          .slice(0, 40) || 'campus'
      : 'campus';
  const dateSlug = new Date().toISOString().slice(0, 10);
  doc.save(`campus-structure-${siteSlug}-${dateSlug}.pdf`);
}
