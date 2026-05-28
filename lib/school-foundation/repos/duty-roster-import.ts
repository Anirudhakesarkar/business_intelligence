import { listStaffMembers } from './foundation-org';
import { listZonesForOrganization } from './foundation-spatial';
import type { DutyRoster } from '../types';
import { listDutyRosters } from './foundation-schedule';
import { orgIdFromPg, resolveOrgIdForPg } from '../../school-db/organization-id';
import { isDbEnabled, withDbTransaction, type DbQueryFn } from './shared';
import { db as memDb, logAudit, _ensureNextIdAbove } from '../store';

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DUTY_TYPES = ['Gate', 'Floor', 'Corridor', 'Playground', 'BusBay', 'Lab', 'Reception', 'EmergencyExit'];

export type DutyRosterImportRow = Record<string, string | number | boolean | undefined>;

export type DutyRosterImportError = { row: number; message: string };

export type DutyRosterImportValidation = {
  valid: boolean;
  errors: DutyRosterImportError[];
  previewCount: number;
  resolvedPreview?: Array<{
    staffName: string;
    zoneName: string;
    dutyType: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isCriticalWindow: boolean;
  }>;
};

type ResolvedRow = Omit<DutyRoster, 'id' | 'isActive'> & {
  preview: NonNullable<DutyRosterImportValidation['resolvedPreview']>[number];
};

type RosterRow = {
  id: string | number;
  organization_id: string | number;
  staff_member_id: string | number;
  zone_id: string | number | null;
  duty_type: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_critical_window: boolean;
  is_active: boolean;
};

function timeToStr(t: string | Date | null): string {
  if (!t) return '';
  const s = typeof t === 'string' ? t : t.toISOString();
  return s.length >= 5 ? s.slice(11, 16) || s.slice(0, 5) : s;
}

function norm(s: unknown): string {
  return String(s ?? '').trim().toLowerCase();
}

function pick(row: DutyRosterImportRow, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function parseDayOfWeek(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (Number.isFinite(n) && n >= 1 && n <= 7) return Math.floor(n);
  const idx = DAY_NAMES.indexOf(t.toLowerCase());
  if (idx >= 0) return idx + 1;
  return null;
}

function parseTime(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function parseCritical(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return t === 'true' || t === '1' || t === 'yes' || t === 'y';
}

async function buildLookup(organizationId: number) {
  const [staff, zones] = await Promise.all([listStaffMembers(organizationId), listZonesForOrganization(organizationId)]);
  return { staff, zones };
}

function resolveRow(
  row: DutyRosterImportRow,
  rowNum: number,
  organizationId: number,
  ctx: Awaited<ReturnType<typeof buildLookup>>,
): { ok: true; value: ResolvedRow } | { ok: false; errors: DutyRosterImportError[] } {
  const errors: DutyRosterImportError[] = [];
  const fail = (message: string) => errors.push({ row: rowNum, message });

  const staffIdRaw = pick(row, 'staffMemberId', 'staff_member_id', 'staffId');
  const staffName = pick(row, 'staffName', 'staff_name', 'staff');
  let staff = staffIdRaw ? ctx.staff.find((s) => String(s.id) === staffIdRaw) : undefined;
  if (!staff && staffName) {
    staff = ctx.staff.find((s) => norm(s.name) === norm(staffName));
    if (!staff) fail(`staff "${staffName}" not found`);
  } else if (!staff) {
    fail('provide staffMemberId or staffName');
  }

  const zoneIdRaw = pick(row, 'zoneId', 'zone_id');
  const zoneName = pick(row, 'zoneName', 'zone_name', 'zone');
  let zone = zoneIdRaw ? ctx.zones.find((z) => String(z.id) === zoneIdRaw) : undefined;
  if (!zone && zoneName) {
    zone = ctx.zones.find((z) => norm(z.name) === norm(zoneName));
    if (!zone) fail(`zone "${zoneName}" not found`);
  }

  const dutyType = pick(row, 'dutyType', 'duty_type', 'duty');
  if (!dutyType) fail('dutyType is required');
  else if (!DUTY_TYPES.includes(dutyType)) fail(`dutyType must be one of: ${DUTY_TYPES.join(', ')}`);

  const dayRaw = pick(row, 'dayOfWeek', 'day_of_week', 'day');
  const dayOfWeek = parseDayOfWeek(dayRaw);
  if (dayOfWeek == null) fail('invalid day (use Monday or 1–7)');

  const startTime = parseTime(pick(row, 'startTime', 'start_time', 'start'));
  const endTime = parseTime(pick(row, 'endTime', 'end_time', 'end'));
  if (!startTime || !endTime) fail('startTime and endTime required (HH:MM)');
  else if (endTime <= startTime) fail('endTime must be after startTime');

  const criticalRaw = pick(row, 'isCriticalWindow', 'is_critical_window', 'critical');
  const isCriticalWindow = criticalRaw ? parseCritical(criticalRaw) : false;

  if (errors.length || !staff || !dutyType || dayOfWeek == null || !startTime || !endTime) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      organizationId,
      staffMemberId: staff.id,
      zoneId: zone?.id,
      dutyType,
      dayOfWeek,
      startTime,
      endTime,
      isCriticalWindow,
      preview: {
        staffName: staff.name,
        zoneName: zone?.name ?? '—',
        dutyType,
        dayOfWeek,
        startTime,
        endTime,
        isCriticalWindow,
      },
    },
  };
}

export async function validateDutyRosterImport(
  organizationId: number,
  rows: DutyRosterImportRow[],
): Promise<DutyRosterImportValidation> {
  const ctx = await buildLookup(organizationId);
  const errors: DutyRosterImportError[] = [];
  const resolved: ResolvedRow[] = [];

  if (!rows.length) {
    return { valid: false, errors: [{ row: 0, message: 'CSV has no data rows' }], previewCount: 0 };
  }

  rows.forEach((row, i) => {
    const result = resolveRow(row, i + 2, organizationId, ctx);
    if (!result.ok) errors.push(...result.errors);
    else resolved.push(result.value);
  });

  return {
    valid: errors.length === 0,
    errors,
    previewCount: rows.length,
    resolvedPreview: resolved.map((r) => r.preview),
  };
}

async function insertDutyRosterTx(
  query: DbQueryFn,
  input: Omit<DutyRoster, 'id' | 'isActive'>,
): Promise<DutyRoster> {
  if (input.endTime <= input.startTime) throw new Error('End time must be after start time.');
  const r = await query<RosterRow>(
    `INSERT INTO school_staff_duty_rosters (
       organization_id, staff_member_id, zone_id, duty_type, day_of_week, start_time, end_time, is_critical_window, is_active
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)
     RETURNING id, organization_id, staff_member_id, zone_id, duty_type, day_of_week, start_time, end_time, is_critical_window, is_active`,
    [
      resolveOrgIdForPg(input.organizationId),
      input.staffMemberId,
      input.zoneId ?? null,
      input.dutyType,
      input.dayOfWeek,
      input.startTime,
      input.endTime,
      input.isCriticalWindow ?? false,
    ],
  );
  if (!r?.rows[0]) throw new Error('Failed to create duty roster');
  return {
    id: Number(r.rows[0].id),
    organizationId: orgIdFromPg(r.rows[0].organization_id),
    staffMemberId: Number(r.rows[0].staff_member_id),
    zoneId: r.rows[0].zone_id != null ? Number(r.rows[0].zone_id) : undefined,
    dutyType: r.rows[0].duty_type,
    dayOfWeek: r.rows[0].day_of_week,
    startTime: timeToStr(r.rows[0].start_time),
    endTime: timeToStr(r.rows[0].end_time),
    isCriticalWindow: r.rows[0].is_critical_window,
    isActive: r.rows[0].is_active,
  };
}

export async function commitDutyRosterImport(
  organizationId: number,
  rows: DutyRosterImportRow[],
): Promise<{ created: number } & DutyRosterImportValidation> {
  const validation = await validateDutyRosterImport(organizationId, rows);
  if (!validation.valid) {
    throw new Error(validation.errors.map((e) => `Row ${e.row}: ${e.message}`).join('; ') || 'Validation failed');
  }

  const ctx = await buildLookup(organizationId);
  const resolved: Omit<DutyRoster, 'id' | 'isActive'>[] = [];
  for (let i = 0; i < rows.length; i++) {
    const result = resolveRow(rows[i], i + 2, organizationId, ctx);
    if (!result.ok) throw new Error(result.errors.map((e) => `Row ${e.row}: ${e.message}`).join('; '));
    const { preview: _preview, ...input } = result.value;
    resolved.push(input);
  }

  let created = 0;
  if (!isDbEnabled()) {
    for (const input of resolved) {
      if (input.endTime <= input.startTime) throw new Error('End time must be after start time.');
      const id = memDb.rosters().length
        ? Math.max(...memDb.rosters().map((r) => r.id)) + 1
        : 1;
      const row = { id, ...input, isActive: true as const };
      memDb.rosters().push(row);
      _ensureNextIdAbove(id);
      logAudit('create', 'duty_roster', id, row);
      created++;
    }
  } else {
    created = await withDbTransaction(async (query) => {
      let count = 0;
      for (const input of resolved) {
        await insertDutyRosterTx(query, input);
        count++;
      }
      return count;
    });
    await listDutyRosters(organizationId);
  }

  return { ...validation, created };
}
