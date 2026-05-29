'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { SMPageHeader } from '@/components/school-management/SMPageHeader';
import { schoolApiDelete, schoolApiGet, schoolApiPatch, schoolApiPost } from '@/lib/school-management/api';

const ORG_ID = 1;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DUTY_TYPES = ['Gate', 'Floor', 'Corridor', 'Playground', 'BusBay', 'Lab', 'Reception', 'EmergencyExit'];

type Row = Record<string, unknown>;
type DutyImportValidation = {
  valid?: boolean;
  errors: Array<{ row: number; message: string } | string>;
  previewCount?: number;
  resolvedPreview?: Array<Record<string, unknown>>;
  created?: number;
};

function useRosters() {
  return useQuery({ queryKey: ['sm-roster', ORG_ID], queryFn: () => schoolApiGet(`/api/staff-duty-rosters?organizationId=${ORG_ID}`) });
}
function useStaff() {
  return useQuery({ queryKey: ['sm-staff', ORG_ID], queryFn: () => schoolApiGet(`/api/staff-members?organizationId=${ORG_ID}`) });
}
function useZones() {
  return useQuery({ queryKey: ['sm-zones', ORG_ID], queryFn: () => schoolApiGet(`/api/zones?organizationId=${ORG_ID}`) });
}
function useFloors() {
  return useQuery({ queryKey: ['sm-floors', ORG_ID], queryFn: () => schoolApiGet(`/api/floors?organizationId=${ORG_ID}`) });
}
function useBuildings() {
  return useQuery({ queryKey: ['sm-buildings', ORG_ID], queryFn: () => schoolApiGet(`/api/buildings?organizationId=${ORG_ID}`) });
}

// ─── Shared atoms ─────────────────────────────────────────────────────────────
function FormField({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return <div className="space-y-1"><label className="block text-xs font-medium text-slate-400">{label}</label>{children}{error && <p className="text-xs text-red-400">{error}</p>}</div>;
}
function FInput({ value, onChange, type = 'text', placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <input type={type} className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />;
}
function FSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { label: string; value: string | number }[] }) {
  return <select className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500" value={value} onChange={(e) => onChange(e.target.value)}><option value="">— select —</option>{options.map((o) => <option key={o.value} value={String(o.value)}>{o.label}</option>)}</select>;
}
function FToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
      <div className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-amber-500' : 'bg-slate-700'}`} onClick={() => onChange(!checked)}>
        <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </div>
      {label}
    </label>
  );
}
function SHdr({ title, onClose }: { title: string; onClose: () => void }) {
  return <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 flex-shrink-0"><h2 className="text-base font-semibold text-slate-100">{title}</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-xl">&times;</button></div>;
}

// ─── Gap detector ─────────────────────────────────────────────────────────────
function GapWarnings({ rosters }: { rosters: Row[] }) {
  // Critical windows with no staff assigned: check Gate at arrival/dispersal, Playground at break/lunch
  const criticalUnstaffed = rosters.filter((r) => r.isCriticalWindow && r.staffMemberId == null);
  const criticalTotal = rosters.filter((r) => r.isCriticalWindow).length;
  const gaps = DUTY_TYPES.filter((dt) => {
    const hasCritical = rosters.some((r) => r.dutyType === dt && r.isCriticalWindow);
    return hasCritical && !rosters.some((r) => r.dutyType === dt && r.isCriticalWindow && r.staffMemberId);
  });

  if (!gaps.length && criticalTotal > 0) return null;
  if (!rosters.length) return null;

  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 space-y-1">
      <p className="text-xs font-semibold text-red-400">⚠ Critical window coverage gaps</p>
      {gaps.map((dt) => (
        <p key={dt} className="text-xs text-red-300">• {dt}: critical window has no staff assigned</p>
      ))}
      {!criticalTotal && <p className="text-xs text-amber-400">No critical windows defined yet — mark Gate and Playground duties as critical.</p>}
    </div>
  );
}

// ─── Duty grid (time × duty type) ────────────────────────────────────────────
function DutyGrid({ rosters, staff, zones, dayFilter }: { rosters: Row[]; staff: Row[]; zones: Row[]; dayFilter: number | null }) {
  const staffMap = Object.fromEntries(staff.map((s) => [String(s.id), s]));
  const zoneMap = Object.fromEntries(zones.map((z) => [String(z.id), z]));

  const filtered = dayFilter != null ? rosters.filter((r) => Number(r.dayOfWeek) === dayFilter) : rosters;

  // Collect unique time slots
  const slots = [...new Set(filtered.map((r) => `${r.startTime}–${r.endTime}`))].sort();

  if (!filtered.length) return <p className="py-10 text-center text-sm text-slate-500">No roster entries for this day. Use + Add Entry to create duty assignments.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[600px]">
        <thead>
          <tr className="bg-slate-900">
            <th className="px-3 py-2 text-left text-xs text-slate-500 font-semibold uppercase border-r border-slate-800 w-32">Time slot</th>
            {DUTY_TYPES.map((dt) => (
              <th key={dt} className="px-3 py-2 text-center text-xs text-slate-500 font-semibold uppercase border-r border-slate-800 last:border-r-0">{dt}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => {
            const [start, end] = slot.split('–');
            return (
              <tr key={slot} className="border-t border-slate-800">
                <td className="px-3 py-2 text-xs text-slate-500 font-mono border-r border-slate-800 whitespace-nowrap">
                  <div>{start}</div><div className="text-slate-600">{end}</div>
                </td>
                {DUTY_TYPES.map((dt) => {
                  const entries = filtered.filter((r) => r.dutyType === dt && `${r.startTime}–${r.endTime}` === slot);
                  return (
                    <td key={dt} className="px-2 py-1.5 border-r border-slate-800 last:border-r-0 align-top min-w-[100px]">
                      {entries.map((r) => {
                        const s = staffMap[String(r.staffMemberId)];
                        const z = r.zoneId ? zoneMap[String(r.zoneId)] : null;
                        const isCriticalWindow = Boolean(r.isCriticalWindow);
                        return (
                          <div key={String(r.id ?? `${r.staffMemberId}-${r.dayOfWeek}-${r.startTime}-${r.zoneId}`)} className={`rounded p-1.5 text-xs mb-1 ${isCriticalWindow ? 'border border-amber-500/40 bg-amber-500/5' : 'bg-slate-800/60'}`}>
                            {isCriticalWindow && <span className="text-amber-400 text-xs">⚡ </span>}
                            <span className="text-slate-200 font-medium">{s ? String(s.name) : '—'}</span>
                            {z && <div className="text-slate-600 truncate">{String(z.name)}</div>}
                          </div>
                        );
                      })}
                      {!entries.length && <div className="h-8 rounded bg-slate-900/40 border border-dashed border-slate-800" />}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── CSV Import Sheet ─────────────────────────────────────────────────────────
function ImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [validation, setValidation] = useState<DutyImportValidation | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const fileRef = useRef<HTMLInputElement>(null);

  const validateMut = useMutation({
    mutationFn: (data: Row[]) =>
      schoolApiPost<DutyImportValidation>('/api/staff-duty-rosters/validate-import', {
        organizationId: ORG_ID,
        rows: data,
        commit: false,
      }),
    onSuccess: (res) => {
      setValidation(res);
      setStep('preview');
    },
  });

  const commitMut = useMutation({
    mutationFn: () =>
      schoolApiPost<DutyImportValidation>('/api/staff-duty-rosters/validate-import', {
        organizationId: ORG_ID,
        rows,
        commit: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sm-roster'] });
      qc.invalidateQueries({ queryKey: ['sm-setup-health'] });
      setStep('done');
    },
  });

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? '');
      const lines = text.trim().split('\n');
      if (lines.length < 2) return;
      const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
      const parsed = lines
        .slice(1)
        .filter((line) => line.trim())
        .map((line) =>
          Object.fromEntries(
            headers.map((h, i) => [h, line.split(',')[i]?.trim().replace(/^"|"$/g, '') ?? '']),
          ),
        );
      setRows(parsed);
      validateMut.mutate(parsed);
    };
    reader.readAsText(file);
  };

  const reset = () => {
    setRows([]);
    setValidation(null);
    setStep('upload');
  };

  const formatError = (e: DutyImportValidation['errors'][number]) =>
    typeof e === 'string' ? e : `Row ${e.row}: ${e.message}`;

  return (
    <Sheet open={open} onClose={() => { onClose(); reset(); }}>
      <SHdr title="Import Duty Roster (CSV)" onClose={() => { onClose(); reset(); }} />
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {step === 'upload' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Columns: <code className="text-slate-300">staffMemberId, zoneId, dutyType, dayOfWeek, startTime, endTime, isCriticalWindow</code>
              {' '}(or staffName / zoneName / day name)
            </p>
            <div
              className="rounded-lg border-2 border-dashed border-slate-700 p-8 text-center cursor-pointer hover:border-slate-500"
              onClick={() => fileRef.current?.click()}
            >
              <p className="text-sm text-slate-400">Click to select CSV</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) parseFile(f);
              }}
            />
            {validateMut.isPending && <p className="text-xs text-slate-500">Validating…</p>}
          </div>
        )}
        {step === 'preview' && validation && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-300">{rows.length} row(s) parsed</p>
              <button onClick={reset} className="text-xs text-slate-500 hover:text-slate-300">
                ← Re-upload
              </button>
            </div>
            {validation.errors?.length > 0 && (
              <div className="rounded bg-red-500/10 p-3 space-y-1">
                <p className="text-xs font-semibold text-red-400">Errors (must fix before importing):</p>
                {validation.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-400">
                    {formatError(e)}
                  </p>
                ))}
              </div>
            )}
            {!validation.errors?.length && <p className="text-xs text-green-400">✓ Validation passed — ready to import</p>}
            {validation.resolvedPreview && validation.resolvedPreview.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-800 max-h-48">
                <table className="w-full text-xs">
                  <thead className="bg-slate-900 text-slate-500">
                    <tr>
                      <th className="px-2 py-1 text-left">Staff</th>
                      <th className="px-2 py-1 text-left">Duty</th>
                      <th className="px-2 py-1 text-left">Day</th>
                      <th className="px-2 py-1 text-left">Time</th>
                      <th className="px-2 py-1 text-left">Zone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.resolvedPreview.slice(0, 15).map((r, i) => (
                      <tr
                        key={`${r.staffName}|${r.dutyType}|${r.dayOfWeek}|${r.startTime}|${r.zoneName}|${i}`}
                        className="border-t border-slate-800 text-slate-400"
                      >
                        <td className="px-2 py-1">{String(r.staffName)}</td>
                        <td className="px-2 py-1">{String(r.dutyType)}</td>
                        <td className="px-2 py-1">{DAYS[Number(r.dayOfWeek) - 1] ?? r.dayOfWeek}</td>
                        <td className="px-2 py-1 font-mono">
                          {String(r.startTime)}–{String(r.endTime)}
                        </td>
                        <td className="px-2 py-1">{String(r.zoneName)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {step === 'done' && (
          <p className="text-sm text-green-400 py-4 text-center">
            ✓ {commitMut.data?.created ?? rows.length} entries imported.
          </p>
        )}
      </div>
      <div className="border-t border-slate-800 px-6 py-4 flex gap-2 justify-end flex-shrink-0">
        <Button variant="outline" onClick={() => { onClose(); reset(); }}>
          Close
        </Button>
        {step === 'preview' && validation?.valid && (
          <Button onClick={() => commitMut.mutate()} disabled={commitMut.isPending}>
            {commitMut.isPending ? 'Importing…' : `Import ${rows.length} entries`}
          </Button>
        )}
      </div>
    </Sheet>
  );
}

const EMPTY_DUTY_FORM = {
  staffMemberId: '',
  zoneId: '',
  dutyType: 'Gate',
  dayOfWeek: '1',
  startTime: '07:30',
  endTime: '08:30',
  isCriticalWindow: false,
};

// ─── Add / Edit Entry Sheet ───────────────────────────────────────────────────
function DutyEntrySheet({
  open,
  onClose,
  entry,
}: {
  open: boolean;
  onClose: () => void;
  entry?: Row | null;
}) {
  const qc = useQueryClient();
  const { data: staffRaw = [] }     = useStaff();
  const { data: zonesRaw = [] }     = useZones();
  const { data: floorsRaw = [] }    = useFloors();
  const { data: buildingsRaw = [] } = useBuildings();

  const staff     = Array.isArray(staffRaw)     ? staffRaw     : [];
  const zones     = Array.isArray(zonesRaw)     ? zonesRaw     : [];
  const floors    = Array.isArray(floorsRaw)    ? floorsRaw    : [];
  const buildings = Array.isArray(buildingsRaw) ? buildingsRaw : [];

  const isEdit = Boolean(entry?.id);
  const [form, setForm] = useState(EMPTY_DUTY_FORM);
  const [errs, setErrs] = useState<Record<string, string>>({});

  // Build zone options with floor + building context labels
  const zoneOpts = zones.map((z: Row) => {
    const floor    = floors.find((f) => Number(f.id) === Number(z.floorId));
    const building = floor ? buildings.find((b) => Number(b.id) === Number(floor.buildingId)) : null;
    const ctx = [building ? String(building.name) : null, floor ? String(floor.name) : null].filter(Boolean).join(' › ');
    return { label: ctx ? `${String(z.name)}  (${ctx})` : String(z.name), value: String(z.id) };
  });

  const staffOpts = staff.map((s: Row) => ({ label: String(s.name), value: String(s.id) }));
  const dayOpts   = DAYS.map((d, i) => ({ label: d, value: String(i + 1) }));
  const dutyOpts  = DUTY_TYPES.map((d) => ({ label: d, value: d }));

  const resetForm = () => {
    if (entry) {
      setForm({
        staffMemberId: String(entry.staffMemberId ?? ''),
        zoneId: entry.zoneId ? String(entry.zoneId) : '',
        dutyType: String(entry.dutyType ?? 'Gate'),
        dayOfWeek: String(entry.dayOfWeek ?? '1'),
        startTime: String(entry.startTime ?? '07:30'),
        endTime: String(entry.endTime ?? '08:30'),
        isCriticalWindow: Boolean(entry.isCriticalWindow),
      });
    } else {
      setForm(EMPTY_DUTY_FORM);
    }
    setErrs({});
  };

  const create = useMutation({
    mutationFn: (b: unknown) => schoolApiPost('/api/staff-duty-rosters', b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sm-roster'] }); qc.invalidateQueries({ queryKey: ['sm-setup-health'] }); onClose(); setErrs({}); },
    onError: (e: Error) => setErrs({ _api: e.message }),
  });

  const update = useMutation({
    mutationFn: (b: unknown) => schoolApiPatch(`/api/staff-duty-rosters/${entry!.id}`, b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sm-roster'] }); qc.invalidateQueries({ queryKey: ['sm-setup-health'] }); onClose(); setErrs({}); },
    onError: (e: Error) => setErrs({ _api: e.message }),
  });

  const set = (k: string) => (v: string) => { setErrs({}); setForm((f) => ({ ...f, [k]: v })); };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!form.staffMemberId) e.staffMemberId = 'Staff member is required';
    if (!form.dutyType) e.dutyType = 'Duty type is required';
    if (!form.dayOfWeek) e.dayOfWeek = 'Day is required';
    if (!form.startTime || !form.endTime) e.startTime = 'Start and end times are required';
    else if (form.endTime <= form.startTime) e.endTime = 'End time must be after start time';
    return e;
  };

  const save = () => {
    const e = validate();
    if (Object.keys(e).length) return setErrs(e);
    const body = {
      staffMemberId: Number(form.staffMemberId),
      zoneId: form.zoneId ? Number(form.zoneId) : undefined,
      dutyType: form.dutyType,
      dayOfWeek: Number(form.dayOfWeek),
      startTime: form.startTime,
      endTime: form.endTime,
      isCriticalWindow: form.isCriticalWindow,
    };
    if (isEdit) update.mutate(body);
    else create.mutate({ organizationId: ORG_ID, ...body });
  };

  const pending = create.isPending || update.isPending;

  useEffect(() => {
    if (open) resetForm();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry]);

  return (
    <Sheet open={open} onClose={onClose}>
      <SHdr title={isEdit ? 'Edit Duty Assignment' : 'Add Duty Assignment'} onClose={onClose} />
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {errs._api && <p className="rounded bg-red-500/10 px-3 py-2 text-xs text-red-400">{errs._api}</p>}
        <FormField label="Staff member *" error={errs.staffMemberId}>
          <FSelect value={form.staffMemberId} onChange={set('staffMemberId')} options={staffOpts} />
          {staffOpts.length === 0 && <p className="text-xs text-slate-500">No staff found — add staff in Master Data first.</p>}
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Duty type *" error={errs.dutyType}>
            <FSelect value={form.dutyType} onChange={set('dutyType')} options={dutyOpts} />
          </FormField>
          <FormField label="Day *" error={errs.dayOfWeek}>
            <FSelect value={form.dayOfWeek} onChange={set('dayOfWeek')} options={dayOpts} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Start time *" error={errs.startTime}>
            <FInput type="time" value={form.startTime} onChange={set('startTime')} />
          </FormField>
          <FormField label="End time *" error={errs.endTime}>
            <FInput type="time" value={form.endTime} onChange={set('endTime')} />
          </FormField>
        </div>
        <FormField label="Zone (optional — Building › Floor shown for context)">
          <FSelect value={form.zoneId} onChange={set('zoneId')} options={zoneOpts} />
          {zoneOpts.length === 0 && <p className="text-xs text-slate-500">No zones found — add zones in Master Data first.</p>}
        </FormField>
        <FToggle
          label="Critical window (⚡ shown as gap if unstaffed)"
          checked={form.isCriticalWindow}
          onChange={(v) => setForm((f) => ({ ...f, isCriticalWindow: v }))}
        />
      </div>
      <div className="border-t border-slate-800 px-6 py-4 flex gap-2 justify-end flex-shrink-0">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={pending}>
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add assignment'}
        </Button>
      </div>
    </Sheet>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
type ViewMode = 'grid' | 'list';

export default function StaffDutyPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useRosters();
  const { data: staff = [] } = useStaff();
  const { data: zones = [] } = useZones();
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [dutyFilter, setDutyFilter] = useState('');
  const [view, setView] = useState<ViewMode>('grid');
  const [addOpen, setAddOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<Row | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const remove = useMutation({
    mutationFn: (id: number) => schoolApiDelete(`/api/staff-duty-rosters/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sm-roster'] }); qc.invalidateQueries({ queryKey: ['sm-setup-health'] }); },
  });

  const rosters: Row[] = Array.isArray(data) ? data : [];
  const staffArr: Row[] = Array.isArray(staff) ? staff : [];
  const zonesArr: Row[] = Array.isArray(zones) ? zones : [];
  const staffMap = Object.fromEntries(staffArr.map((s) => [String(s.id), s]));
  const zoneMap = Object.fromEntries(zonesArr.map((z) => [String(z.id), z]));

  const handleDelete = (r: Row) => {
    const staffName = String(staffMap[String(r.staffMemberId)]?.name ?? `ID:${r.staffMemberId}`);
    const dayLabel = DAYS[Number(r.dayOfWeek) - 1] ?? String(r.dayOfWeek);
    if (
      !window.confirm(
        `Remove duty assignment for ${staffName} (${String(r.dutyType)}, ${dayLabel} ${String(r.startTime)}–${String(r.endTime)})?`,
      )
    ) {
      return;
    }
    remove.mutate(Number(r.id));
  };

  const filtered = rosters.filter((r) =>
    (dayFilter == null || Number(r.dayOfWeek) === dayFilter) &&
    (!dutyFilter || r.dutyType === dutyFilter)
  );

  const exportCsv = () => {
    const cols = ['id', 'staffMemberId', 'zoneId', 'dutyType', 'dayOfWeek', 'startTime', 'endTime', 'isCriticalWindow'];
    const lines = [cols.join(','), ...rosters.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(','))];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })); a.download = 'duty-roster.csv'; a.click();
  };

  const criticalCount = rosters.filter((r) => r.isCriticalWindow).length;
  const gapCount = DUTY_TYPES.filter((dt) =>
    rosters.some((r) => r.dutyType === dt && r.isCriticalWindow) &&
    !rosters.some((r) => r.dutyType === dt && r.isCriticalWindow && r.staffMemberId)
  ).length;

  return (
    <div className="space-y-6">
      <SMPageHeader
        title="Staff Duty Roster"
        subtitle="Gate, floor, corridor, playground, bus bay, lab, and emergency exit coverage. ⚡ marks critical windows."
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportCsv}>Export CSV</Button>
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>Import CSV</Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>+ Add Duty</Button>
          </div>
        }
      />

      {/* Stats */}
      {!isLoading && rosters.length > 0 && (
        <div className="flex flex-wrap gap-4 text-xs">
          <span className="text-slate-500">{rosters.length} total assignments</span>
          <span className="text-amber-400">⚡ {criticalCount} critical windows</span>
          {gapCount > 0 && <span className="text-red-400">⚠ {gapCount} gap(s) in critical coverage</span>}
          {gapCount === 0 && criticalCount > 0 && <span className="text-green-400">✓ All critical windows staffed</span>}
        </div>
      )}

      <GapWarnings rosters={rosters} />

      {/* Filters + view toggle */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <select className="h-9 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-300 focus:outline-none" value={dayFilter ?? ''} onChange={(e) => setDayFilter(e.target.value ? Number(e.target.value) : null)}>
            <option value="">All days</option>
            {DAYS.map((d, i) => <option key={i} value={i + 1}>{d}</option>)}
          </select>
          <select className="h-9 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-300 focus:outline-none" value={dutyFilter} onChange={(e) => setDutyFilter(e.target.value)}>
            <option value="">All duty types</option>
            {DUTY_TYPES.map((dt) => <option key={dt} value={dt}>{dt}</option>)}
          </select>
          {(dayFilter != null || dutyFilter) && <button onClick={() => { setDayFilter(null); setDutyFilter(''); }} className="text-xs text-slate-500 hover:text-slate-300 px-2">Clear</button>}
        </div>
        <div className="flex rounded-md border border-slate-700 overflow-hidden text-sm">
          {(['grid', 'list'] as ViewMode[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 capitalize ${view === v ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>{v}</button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading roster…</p>}

      {!isLoading && view === 'grid' && (
        <div className="rounded-lg border border-slate-800 overflow-hidden">
          <DutyGrid rosters={filtered} staff={staffArr} zones={zonesArr} dayFilter={dayFilter} />
        </div>
      )}

      {!isLoading && view === 'list' && (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Staff</th>
                <th className="px-3 py-2 text-left">Duty</th>
                <th className="px-3 py-2 text-left">Day</th>
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Zone</th>
                <th className="px-3 py-2 text-left">Critical</th>
                <th className="px-3 py-2 text-right w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.sort((a, b) => Number(a.dayOfWeek) - Number(b.dayOfWeek) || String(a.startTime).localeCompare(String(b.startTime))).map((r) => {
                const isCriticalWindow = Boolean(r.isCriticalWindow);
                const staffName = String(staffMap[String(r.staffMemberId)]?.name ?? `ID:${r.staffMemberId}`);
                const dayLabel = DAYS[Number(r.dayOfWeek) - 1] ?? String(r.dayOfWeek);
                return (
                  <tr key={String(r.id)} className={`border-t border-slate-800 text-slate-300 hover:bg-slate-800/40 ${isCriticalWindow ? 'bg-amber-500/5' : ''}`}>
                    <td className="px-3 py-2 font-medium text-slate-100">{staffName}</td>
                    <td className="px-3 py-2"><span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">{String(r.dutyType)}</span></td>
                    <td className="px-3 py-2">{dayLabel}</td>
                    <td className="px-3 py-2 font-mono text-xs">{String(r.startTime)}–{String(r.endTime)}</td>
                    <td className="px-3 py-2 text-slate-500 text-xs">{r.zoneId ? String(zoneMap[String(r.zoneId)]?.name ?? r.zoneId) : '—'}</td>
                    <td className="px-3 py-2">{isCriticalWindow ? <span className="text-amber-400 text-xs font-semibold">⚡ Critical</span> : <span className="text-slate-600 text-xs">—</span>}</td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button type="button" onClick={() => setEditEntry(r)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                      <button type="button" onClick={() => handleDelete(r)} className="text-xs text-red-400 hover:text-red-300" disabled={remove.isPending}>Remove</button>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500 text-xs">No roster entries. Use + Add Entry to create duty assignments.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <DutyEntrySheet open={addOpen} onClose={() => setAddOpen(false)} />
      <DutyEntrySheet open={Boolean(editEntry)} entry={editEntry} onClose={() => setEditEntry(null)} />
      <ImportSheet open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
