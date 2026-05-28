'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { SMPageHeader } from '@/components/school-management/SMPageHeader';
import { schoolApiGet, schoolApiPatch, schoolApiPost } from '@/lib/school-management/api';

const ORG_ID = 1;

// ─── Types ────────────────────────────────────────────────────────────────────
type Row = Record<string, unknown>;
type MappingStatus = {
  mappingPercent?: number;
  totalCameras?: number;
  unmappedCount?: number;
  classroomMissingRoom?: number;
};
type CameraImportResult = {
  errors?: string[];
};

const PURPOSES = ['Classroom', 'Gate', 'Corridor', 'Staircase', 'Playground', 'Lab', 'Library', 'Reception', 'Parking', 'RestrictedZone', 'Compliance'];
const PROCESS_OWNERS = ['Academic', 'Discipline', 'Compliance', 'ParentExperience', 'StudentOccupancy', 'StaffDeployment'];
const CRITICALITIES = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES = ['Active', 'Inactive', 'Offline', 'Maintenance'];

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useCameras() { return useQuery({ queryKey: ['sm-cameras', ORG_ID], queryFn: () => schoolApiGet(`/api/cameras?organizationId=${ORG_ID}`) }); }
function useSites() { return useQuery({ queryKey: ['sm-sites', ORG_ID], queryFn: () => schoolApiGet(`/api/sites?organizationId=${ORG_ID}`) }); }
function useBuildings() { return useQuery({ queryKey: ['sm-buildings-all'], queryFn: () => schoolApiGet('/api/buildings') }); }
function useFloors() { return useQuery({ queryKey: ['sm-floors-all'], queryFn: () => schoolApiGet('/api/floors') }); }
function useZones() { return useQuery({ queryKey: ['sm-zones-all'], queryFn: () => schoolApiGet('/api/zones') }); }
function useRooms() { return useQuery({ queryKey: ['sm-rooms', ORG_ID], queryFn: () => schoolApiGet(`/api/rooms?organizationId=${ORG_ID}`) }); }
function useMappingStatus() { return useQuery({ queryKey: ['sm-mapping-status', ORG_ID], queryFn: () => schoolApiGet<MappingStatus>(`/api/cameras/mapping-status?organizationId=${ORG_ID}`) }); }

// ─── Shared atoms ─────────────────────────────────────────────────────────────
function Pill({ label, color }: { label: string; color: 'green' | 'red' | 'amber' | 'blue' | 'slate' }) {
  const cls = { green: 'bg-green-500/10 text-green-400', red: 'bg-red-500/10 text-red-400', amber: 'bg-amber-500/10 text-amber-400', blue: 'bg-blue-500/10 text-blue-400', slate: 'bg-slate-700 text-slate-400' }[color];
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

function purposeColor(p: string): 'green' | 'red' | 'amber' | 'blue' | 'slate' {
  if (['Classroom', 'Lab', 'Library'].includes(p)) return 'blue';
  if (['Gate', 'Staircase', 'RestrictedZone'].includes(p)) return 'amber';
  if (['Compliance'].includes(p)) return 'red';
  return 'slate';
}

function statusColor(s: string): 'green' | 'red' | 'amber' | 'blue' | 'slate' {
  if (s === 'Active') return 'green';
  if (s === 'Offline') return 'red';
  if (s === 'Maintenance') return 'amber';
  return 'slate';
}

function critColor(c: string): 'green' | 'red' | 'amber' | 'blue' | 'slate' {
  if (c === 'Critical') return 'red';
  if (c === 'High') return 'amber';
  if (c === 'Low') return 'green';
  return 'slate';
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-slate-400">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function FInput({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <input type={type} className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />;
}

function FSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { label: string; value: string }[] }) {
  return (
    <select className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— select —</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function SHdr({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 flex-shrink-0">
      <h2 className="text-base font-semibold text-slate-100">{title}</h2>
      <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-xl">&times;</button>
    </div>
  );
}

// ─── Mapping Status Banner ────────────────────────────────────────────────────
function MappingStatusBanner() {
  const { data } = useMappingStatus();
  if (!data) return null;
  const pct = data.mappingPercent ?? 0;
  const totalCameras = data.totalCameras ?? 0;
  const unmappedCount = data.unmappedCount ?? 0;
  const classroomMissingRoom = data.classroomMissingRoom ?? 0;
  const color = pct >= 90 ? 'border-green-500/30 bg-green-500/5' : pct >= 60 ? 'border-amber-500/30 bg-amber-500/5' : 'border-red-500/30 bg-red-500/5';
  const textColor = pct >= 90 ? 'text-green-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className={`flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3 ${color}`}>
      <div>
        <span className={`text-sm font-semibold ${textColor}`}>{pct}% mapped</span>
        <span className="ml-2 text-xs text-slate-500">{totalCameras} total cameras</span>
      </div>
      {unmappedCount > 0 && <span className="text-xs text-amber-400">{unmappedCount} camera(s) missing location or purpose</span>}
      {classroomMissingRoom > 0 && <span className="text-xs text-red-400">{classroomMissingRoom} classroom/lab camera(s) missing room assignment</span>}
    </div>
  );
}

// ─── Mapping Diagram ─────────────────────────────────────────────────────────
function MappingDiagram({ cameras, zones, rooms }: { cameras: Row[]; zones: Row[]; rooms: Row[] }) {
  const zoneMap = Object.fromEntries(zones.map((z) => [String(z.id), z]));
  const roomMap = Object.fromEntries(rooms.map((r) => [String(r.id), r]));
  const byPurpose: Record<string, Row[]> = {};
  cameras.forEach((c) => {
    const p = String(c.purpose ?? 'Unknown');
    if (!byPurpose[p]) byPurpose[p] = [];
    byPurpose[p].push(c);
  });
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Camera → Purpose → Location</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(byPurpose).map(([purpose, cams]) => (
          <div key={purpose} className="rounded border border-slate-700 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Pill label={purpose} color={purposeColor(purpose)} />
              <span className="text-xs text-slate-500">{cams.length}</span>
            </div>
            <div className="space-y-1">
              {cams.slice(0, 5).map((c) => {
                const zone = c.zoneId ? zoneMap[String(c.zoneId)] : null;
                const room = c.roomId ? roomMap[String(c.roomId)] : null;
                return (
                  <div key={String(c.id)} className="flex items-center gap-2 text-xs">
                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${c.status === 'Active' ? 'bg-green-400' : c.status === 'Offline' ? 'bg-red-400' : 'bg-amber-400'}`} />
                    <span className="text-slate-300 truncate">{String(c.name ?? c.cameraCode)}</span>
                    <span className="text-slate-600 truncate">{room ? String(room.roomName ?? '') : zone ? String(zone.name ?? '') : '—'}</span>
                  </div>
                );
              })}
              {cams.length > 5 && <p className="text-xs text-slate-600">+{cams.length - 5} more</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CSV Import Preview ───────────────────────────────────────────────────────
function CsvImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const fileRef = useRef<HTMLInputElement>(null);

  const importMut = useMutation({
    mutationFn: (data: Row[]) => schoolApiPost<CameraImportResult>('/api/cameras/import', { organizationId: ORG_ID, rows: data }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['sm-cameras'] });
      qc.invalidateQueries({ queryKey: ['sm-mapping-status'] });
      if (res.errors?.length) setErrors(res.errors);
      setStep('done');
    },
  });

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? '');
      const lines = text.trim().split('\n');
      if (lines.length < 2) return setErrors(['File must have a header row and at least one data row']);
      const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
      const parsed = lines.slice(1).map((line) => {
        const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
        return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ''])) as Row;
      });
      setRows(parsed); setErrors([]); setStep('preview');
    };
    reader.readAsText(file);
  };

  const reset = () => { setRows([]); setErrors([]); setStep('upload'); };

  return (
    <Sheet open={open} onClose={() => { onClose(); reset(); }}>
      <SHdr title="Import Cameras (CSV)" onClose={() => { onClose(); reset(); }} />
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">CSV must have columns: <code className="text-slate-300">cameraCode, purpose, processOwner, criticality, zoneId, roomId, activeFrom, activeTo</code></p>
            <p className="text-xs text-slate-500">name, streamUrl and status are managed in the renderer — omit them from this CSV.</p>
            <div className="rounded-lg border-2 border-dashed border-slate-700 p-8 text-center cursor-pointer hover:border-slate-500 transition-colors" onClick={() => fileRef.current?.click()}>
              <p className="text-sm text-slate-400">Click to select a CSV file</p>
              <p className="text-xs text-slate-600 mt-1">or drag and drop</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
            {errors.map((e, i) => <p key={i} className="text-xs text-red-400">{e}</p>)}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-300">{rows.length} row(s) parsed</p>
              <button onClick={reset} className="text-xs text-slate-500 hover:text-slate-300">← Re-upload</button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-800 max-h-64">
              <table className="w-full text-xs">
                <thead className="bg-slate-900 text-slate-500"><tr>{Object.keys(rows[0] ?? {}).map((k) => <th key={k} className="px-2 py-1 text-left whitespace-nowrap">{k}</th>)}</tr></thead>
                <tbody>
                  {rows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t border-slate-800 text-slate-300">
                      {Object.values(r).map((v, j) => <td key={j} className="px-2 py-1 max-w-[120px] truncate">{String(v ?? '—')}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 20 && <p className="text-xs text-slate-500">Showing first 20 rows of {rows.length}</p>}
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-2">
            <p className="text-sm text-green-400">Import complete.</p>
            {errors.map((e, i) => <p key={i} className="text-xs text-amber-400">{e}</p>)}
          </div>
        )}
      </div>
      <div className="border-t border-slate-800 px-6 py-4 flex gap-2 justify-end flex-shrink-0">
        <Button variant="outline" onClick={() => { onClose(); reset(); }}>Close</Button>
        {step === 'preview' && <Button onClick={() => importMut.mutate(rows)} disabled={importMut.isPending}>{importMut.isPending ? 'Importing…' : `Import ${rows.length} cameras`}</Button>}
      </div>
    </Sheet>
  );
}

// ─── Camera Form Sheet ────────────────────────────────────────────────────────
// NOTE: name, streamUrl, and status are intentionally excluded — they are
// already captured during hardware onboarding in the renderer app.
// name    → auto-set to cameraCode on create; kept as-is on patch
// streamUrl → kept as-is on patch; empty string on create
// status  → defaults to 'Active'; managed by the renderer thereafter
type CameraForm = { cameraCode: string; purpose: string; processOwner: string; criticality: string; zoneId: string; roomId: string; activeFrom: string; activeTo: string; };
const emptyForm = (): CameraForm => ({ cameraCode: '', purpose: 'Classroom', processOwner: 'Academic', criticality: 'Medium', zoneId: '', roomId: '', activeFrom: '', activeTo: '' });

function CameraFormSheet({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Row | null }) {
  const qc = useQueryClient();
  const { data: zones = [] } = useQuery({ queryKey: ['sm-zones-all'], queryFn: () => schoolApiGet('/api/zones') });
  const { data: rooms = [] } = useQuery({ queryKey: ['sm-rooms', ORG_ID], queryFn: () => schoolApiGet(`/api/rooms?organizationId=${ORG_ID}`) });
  const [form, setForm] = useState<CameraForm>(emptyForm);
  const [err, setErr] = useState('');

  // Populate form when editing changes
  useState(() => {
    if (editing) {
      setForm({ cameraCode: String(editing.cameraCode ?? ''), purpose: String(editing.purpose ?? 'Classroom'), processOwner: String(editing.processOwner ?? 'Academic'), criticality: String(editing.criticality ?? 'Medium'), zoneId: String(editing.zoneId ?? ''), roomId: String(editing.roomId ?? ''), activeFrom: String(editing.activeFrom ?? ''), activeTo: String(editing.activeTo ?? '') });
    } else {
      setForm(emptyForm());
    }
    setErr('');
  });

  const create = useMutation({
    mutationFn: (b: unknown) => schoolApiPost('/api/cameras', b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sm-cameras'] }); qc.invalidateQueries({ queryKey: ['sm-mapping-status'] }); onClose(); },
    onError: (e: Error) => setErr(e.message),
  });
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: unknown }) => schoolApiPatch(`/api/cameras/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sm-cameras'] }); qc.invalidateQueries({ queryKey: ['sm-mapping-status'] }); onClose(); },
    onError: (e: Error) => setErr(e.message),
  });

  const zoneOpts = (Array.isArray(zones) ? zones : []).map((z: Row) => ({ label: String(z.name), value: String(z.id) }));
  const roomOpts = (Array.isArray(rooms) ? rooms : []).map((r: Row) => ({ label: `${r.roomCode} — ${r.roomName}`, value: String(r.id) }));

  const needsRoom = ['Classroom', 'Lab'].includes(form.purpose);

  const validate = () => {
    if (!form.cameraCode.trim()) return 'Camera code is required';
    if (!form.purpose) return 'Purpose is required';
    if (!form.processOwner) return 'Process owner is required';
    if (!form.zoneId && !form.roomId) return 'Camera must be mapped to a zone or room';
    if (needsRoom && !form.roomId) return 'Classroom and lab cameras must have a room assigned';
    if (form.activeFrom && form.activeTo && form.activeTo <= form.activeFrom) return 'Active end time must be after start time';
    return '';
  };

  const save = () => {
    const e = validate(); if (e) return setErr(e);
    // name, streamUrl, status come from the renderer — on create we default name to
    // cameraCode and streamUrl to ''; on patch we preserve the existing values.
    const rendererFields = editing
      ? { name: String(editing.name ?? form.cameraCode), streamUrl: String(editing.streamUrl ?? ''), status: String(editing.status ?? 'Active') }
      : { name: form.cameraCode, streamUrl: '', status: 'Active' };
    const body = { organizationId: ORG_ID, cameraCode: form.cameraCode, ...rendererFields, purpose: form.purpose, processOwner: form.processOwner, criticality: form.criticality, zoneId: form.zoneId ? Number(form.zoneId) : undefined, roomId: form.roomId ? Number(form.roomId) : undefined, activeFrom: form.activeFrom || undefined, activeTo: form.activeTo || undefined };
    if (editing) patch.mutate({ id: editing.id as number, body });
    else create.mutate(body);
  };

  const set = (k: keyof CameraForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Sheet open={open} onClose={onClose}>
      <SHdr title={editing ? 'Edit Camera' : 'Add Camera'} onClose={onClose} />
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {err && <p className="rounded bg-red-500/10 px-3 py-2 text-xs text-red-400">{err}</p>}
        {/* name, streamUrl and status are set during hardware onboarding in the renderer app — not re-collected here */}
        <div className="rounded-md border border-slate-700/50 bg-slate-800/30 px-3 py-2 text-xs text-slate-500">
          Camera name, stream URL, and status are managed in the <span className="text-slate-400 font-medium">renderer app</span> during hardware onboarding. Only governance fields are set here.
        </div>
        <FormField label="Camera code *"><FInput value={form.cameraCode} onChange={set('cameraCode')} placeholder="CAM-001" /></FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Purpose *"><FSelect value={form.purpose} onChange={set('purpose')} options={PURPOSES.map((p) => ({ label: p, value: p }))} /></FormField>
          <FormField label="Process owner *"><FSelect value={form.processOwner} onChange={set('processOwner')} options={PROCESS_OWNERS.map((p) => ({ label: p, value: p }))} /></FormField>
        </div>
        <FormField label="Criticality"><FSelect value={form.criticality} onChange={set('criticality')} options={CRITICALITIES.map((c) => ({ label: c, value: c }))} /></FormField>
        <div className="border-t border-slate-800 pt-4 space-y-3">
          <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Location mapping</p>
          {needsRoom && <p className="text-xs text-amber-400">⚠ {form.purpose} cameras require a room assignment</p>}
          <FormField label="Zone"><FSelect value={form.zoneId} onChange={set('zoneId')} options={zoneOpts} /></FormField>
          <FormField label={needsRoom ? 'Room *' : 'Room (optional)'}><FSelect value={form.roomId} onChange={set('roomId')} options={roomOpts} /></FormField>
        </div>
        <div className="border-t border-slate-800 pt-4 space-y-3">
          <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Active hours</p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="From"><FInput type="time" value={form.activeFrom} onChange={set('activeFrom')} /></FormField>
            <FormField label="To"><FInput type="time" value={form.activeTo} onChange={set('activeTo')} /></FormField>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-800 px-6 py-4 flex gap-2 justify-end flex-shrink-0">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={create.isPending || patch.isPending}>{(create.isPending || patch.isPending) ? 'Saving…' : editing ? 'Save changes' : 'Add camera'}</Button>
      </div>
    </Sheet>
  );
}

// ─── VIEW TABS ────────────────────────────────────────────────────────────────
type ViewTab = 'table' | 'map';

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function CamerasMappingPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useCameras();
  const { data: zones = [] } = useQuery({ queryKey: ['sm-zones-all'], queryFn: () => schoolApiGet('/api/zones') });
  const { data: rooms = [] } = useRooms();
  const [search, setSearch] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [view, setView] = useState<ViewTab>('table');
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const cameras: Row[] = Array.isArray(data) ? data : [];
  const filtered = cameras.filter((c) => {
    const q = search.toLowerCase();
    const matchQ = !q || String(c.name ?? '').toLowerCase().includes(q) || String(c.cameraCode ?? '').toLowerCase().includes(q);
    const matchP = !purposeFilter || c.purpose === purposeFilter;
    const matchS = !statusFilter || c.status === statusFilter;
    return matchQ && matchP && matchS;
  });

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (row: Row) => { setEditing(row); setFormOpen(true); };

  return (
    <div className="space-y-6">
      <SMPageHeader
        title="Cameras and Mapping"
        subtitle="Register cameras, assign purpose, process owner, and location. Classroom/lab cameras require a room."
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>Import CSV</Button>
            <Button size="sm" onClick={openAdd}>+ Add Camera</Button>
          </div>
        }
      />

      <MappingStatusBanner />

      {/* Filters and view toggle */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <input
            className="h-9 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
            placeholder="Search cameras…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="h-9 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-300 focus:outline-none" value={purposeFilter} onChange={(e) => setPurposeFilter(e.target.value)}>
            <option value="">All purposes</option>
            {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="h-9 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-300 focus:outline-none" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {(search || purposeFilter || statusFilter) && <button onClick={() => { setSearch(''); setPurposeFilter(''); setStatusFilter(''); }} className="text-xs text-slate-500 hover:text-slate-300 px-2">Clear</button>}
        </div>
        <div className="flex rounded-md border border-slate-700 overflow-hidden text-sm">
          {(['table', 'map'] as ViewTab[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 capitalize ${view === v ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>{v}</button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading cameras…</p>}

      {!isLoading && view === 'table' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-500">
            <span>{filtered.length} of {cameras.length} cameras</span>
            <Button size="sm" variant="outline" onClick={() => {
              // name, streamUrl, status are renderer-owned — excluded from governance export
              const cols = ['id', 'cameraCode', 'purpose', 'processOwner', 'criticality', 'zoneId', 'roomId', 'activeFrom', 'activeTo'];
              const lines = [cols.join(','), ...filtered.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(','))];
              const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })); a.download = 'cameras.csv'; a.click();
            }}>Export CSV</Button>
          </div>
          {!filtered.length
            ? <p className="py-10 text-center text-sm text-slate-500">No cameras match filters. Load demo seed or add cameras.</p>
            : (
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Code</th><th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Purpose</th><th className="px-3 py-2">Process Owner</th>
                      <th className="px-3 py-2">Criticality</th><th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Zone</th><th className="px-3 py-2">Room</th>
                      <th className="px-3 py-2">Active hrs</th><th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, i) => {
                      const zone = (Array.isArray(zones) ? zones : []).find((z: Row) => z.id === c.zoneId) as Row | undefined;
                      const room = (Array.isArray(rooms) ? rooms : []).find((r: Row) => r.id === c.roomId) as Row | undefined;
                      return (
                        <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/40 text-slate-300 transition-colors">
                          <td className="px-3 py-2 font-mono text-xs">{String(c.cameraCode)}</td>
                          <td className="px-3 py-2 max-w-[160px] truncate font-medium text-slate-100">{String(c.name)}</td>
                          <td className="px-3 py-2"><Pill label={String(c.purpose)} color={purposeColor(String(c.purpose))} /></td>
                          <td className="px-3 py-2 text-xs text-slate-400">{String(c.processOwner)}</td>
                          <td className="px-3 py-2"><Pill label={String(c.criticality)} color={critColor(String(c.criticality))} /></td>
                          <td className="px-3 py-2"><Pill label={String(c.status)} color={statusColor(String(c.status))} /></td>
                          <td className="px-3 py-2 text-xs text-slate-500 max-w-[100px] truncate">{zone ? String(zone.name) : '—'}</td>
                          <td className="px-3 py-2 text-xs text-slate-500 max-w-[100px] truncate">{room ? String(room.roomName) : '—'}</td>
                          <td className="px-3 py-2 text-xs text-slate-500">{c.activeFrom ? `${c.activeFrom}–${c.activeTo}` : '—'}</td>
                          <td className="px-3 py-2 space-x-2">
                            <Link href={`/dashboard/school-management/cameras/${c.id}`} className="text-xs text-sky-400 hover:underline">AI detail</Link>
                            <button onClick={() => openEdit(c)} className="text-xs text-slate-400 hover:underline">Edit</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      )}

      {!isLoading && view === 'map' && (
        <MappingDiagram cameras={filtered} zones={Array.isArray(zones) ? zones : []} rooms={Array.isArray(rooms) ? rooms : []} />
      )}

      <CameraFormSheet open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <CsvImportSheet open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
