'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { SMPageHeader } from '@/components/school-management/SMPageHeader';
import { schoolApiDelete, schoolApiGet, schoolApiPatch, schoolApiPost } from '@/lib/school-management/api';
import { useSeedDemo, useSetupHealth } from '@/components/school-management/useSchoolFoundation';
import { Database, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { BulkImportButton } from '@/components/school-management/BulkImportButton';
import { CampusTreeView } from '@/components/school-management/CampusTreeView';

const ORG_ID = 1;

// ─── Data hooks ───────────────────────────────────────────────────────────────
function useSites()     { return useQuery({ queryKey: ['sm-sites', ORG_ID],    queryFn: () => schoolApiGet(`/api/sites?organizationId=${ORG_ID}`) }); }
function useBuildings() { return useQuery({ queryKey: ['sm-buildings-all'],    queryFn: () => schoolApiGet('/api/buildings') }); }
function useFloors()    { return useQuery({ queryKey: ['sm-floors-all'],       queryFn: () => schoolApiGet('/api/floors') }); }
function useZones()     { return useQuery({ queryKey: ['sm-zones-all'],        queryFn: () => schoolApiGet('/api/zones') }); }
function useRooms()     { return useQuery({ queryKey: ['sm-rooms', ORG_ID],    queryFn: () => schoolApiGet(`/api/rooms?organizationId=${ORG_ID}`) }); }
function useClasses()   { return useQuery({ queryKey: ['sm-classes', ORG_ID],  queryFn: () => schoolApiGet(`/api/classes?organizationId=${ORG_ID}`) }); }
function useSections(classId?: number) {
  return useQuery({
    queryKey: ['sm-sections', classId],
    queryFn: () => schoolApiGet(`/api/sections?classId=${classId}`),
    enabled: !!classId,
  });
}
function useSubjects()  { return useQuery({ queryKey: ['sm-subjects', ORG_ID], queryFn: () => schoolApiGet(`/api/subjects?organizationId=${ORG_ID}`) }); }
function useTeachers()  { return useQuery({ queryKey: ['sm-teachers', ORG_ID], queryFn: () => schoolApiGet(`/api/teachers?organizationId=${ORG_ID}`) }); }
function useStaff()     { return useQuery({ queryKey: ['sm-staff', ORG_ID],    queryFn: () => schoolApiGet(`/api/staff-members?organizationId=${ORG_ID}`) }); }

const ALL_QUERY_KEYS = [
  ['sm-sites', ORG_ID], ['sm-buildings-all'], ['sm-floors-all'], ['sm-zones-all'],
  ['sm-rooms', ORG_ID], ['sm-classes', ORG_ID], ['sm-subjects', ORG_ID],
  ['sm-teachers', ORG_ID], ['sm-staff', ORG_ID], ['sm-setup-health'],
];

type Row = Record<string, unknown>;

// ─── Shared UI atoms ─────────────────────────────────────────────────────────
function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      className="h-9 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-60"
      placeholder="Search…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Pill({ label, variant }: { label: string; variant?: 'green' | 'red' | 'amber' | 'default' }) {
  const cls = {
    green:   'bg-green-500/10 text-green-400',
    red:     'bg-red-500/10 text-red-400',
    amber:   'bg-amber-500/10 text-amber-400',
    default: 'bg-slate-700 text-slate-300',
  }[variant ?? 'default'];
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
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

function FInput({ value, onChange, placeholder, type = 'text' }: { value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function FSelect({ value, onChange, options }: { value: string | number; onChange: (v: string) => void; options: { label: string; value: string | number }[] }) {
  return (
    <select
      className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— select —</option>
      {options.map((o) => <option key={o.value} value={String(o.value)}>{o.label}</option>)}
    </select>
  );
}

function FToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
      <div
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-700'}`}
        onClick={() => onChange(!checked)}
      >
        <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </div>
      {label}
    </label>
  );
}

function SHdr({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-800 px-6 py-4">
      <h2 className="text-base font-semibold text-slate-100">{title}</h2>
      <button onClick={onClose} className="text-xl leading-none text-slate-400 hover:text-slate-200">&times;</button>
    </div>
  );
}

function SFoot({ onClose, onSave, pending, label }: { onClose: () => void; onSave: () => void; pending?: boolean; label?: string }) {
  return (
    <div className="flex flex-shrink-0 justify-end gap-2 border-t border-slate-800 px-6 py-4">
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button onClick={onSave} disabled={pending}>{pending ? 'Saving…' : label ?? 'Save'}</Button>
    </div>
  );
}

// ─── Export CSV ───────────────────────────────────────────────────────────────
function exportCsv(rows: Row[], cols: string[], filename: string) {
  const header = cols.join(',');
  const lines = rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(','));
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ─── Row selection helpers ────────────────────────────────────────────────────
function rowNumericId(row: Row): number | null {
  const id = Number(row.id);
  return Number.isFinite(id) ? id : null;
}

function rowLabel(row: Row): string {
  return String(row.name ?? row.roomName ?? row.roomCode ?? row.subjectCode ?? row.id ?? '');
}

async function runBulkDelete(
  selected: Row[],
  confirmMessage: string,
  deleteOne: (id: number) => Promise<unknown>,
): Promise<{ ok: number; failed: string[] }> {
  if (!selected.length) return { ok: 0, failed: [] };
  if (!window.confirm(confirmMessage)) return { ok: 0, failed: [] };
  const failed: string[] = [];
  let ok = 0;
  for (const row of selected) {
    const id = rowNumericId(row);
    if (id == null) continue;
    try {
      await deleteOne(id);
      ok++;
    } catch (e) {
      failed.push(`${rowLabel(row)}: ${(e as Error).message}`);
    }
  }
  return { ok, failed };
}

const rowCheckboxClass =
  'h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500';

function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
  totalCount,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  totalCount: number;
}) {
  return (
    <input
      type="checkbox"
      className={rowCheckboxClass}
      checked={checked}
      title={`Select all (${totalCount})`}
      aria-label={`Select all ${totalCount} rows`}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function BulkActionsBar({
  selectedCount,
  onClear,
  onBulkDelete,
  bulkDeleting,
}: {
  selectedCount: number;
  onClear: () => void;
  onBulkDelete: () => void;
  bulkDeleting?: boolean;
}) {
  if (selectedCount === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
      <span className="text-xs font-medium text-slate-300">{selectedCount} selected</span>
      <button type="button" onClick={onClear} className="text-xs text-slate-400 hover:text-slate-200">
        Clear
      </button>
      <Button
        size="sm"
        variant="outline"
        className="ml-auto border-red-800/60 text-red-400 hover:bg-red-950/40 hover:text-red-300"
        disabled={bulkDeleting}
        onClick={onBulkDelete}
      >
        {bulkDeleting ? 'Deleting…' : `Delete selected (${selectedCount})`}
      </Button>
    </div>
  );
}

// ─── Entity table ─────────────────────────────────────────────────────────────
function ETable({
  columns,
  labels,
  rows,
  onEdit,
  onDelete,
  onBulkDelete,
  csvFilename,
}: {
  columns: string[];
  labels?: string[];
  rows: Row[];
  onEdit?: (row: Row) => void;
  onDelete?: (row: Row) => void;
  onBulkDelete?: (selected: Row[]) => void | Promise<void>;
  csvFilename?: string;
}) {
  const [bulkBusy, setBulkBusy] = useState(false);
  const hdrs = labels ?? columns;
  const showActions = Boolean(onEdit || onDelete);
  const selectable = Boolean(onDelete);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const visibleIds = useMemo(
    () => rows.map(rowNumericId).filter((id): id is number => id != null),
    [rows],
  );

  useEffect(() => {
    const valid = new Set(visibleIds);
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleIds]);

  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected = visibleIds.some((id) => selectedIds.has(id));
  const selectedCount = visibleIds.filter((id) => selectedIds.has(id)).length;
  const selectedRows = rows.filter((r) => {
    const id = rowNumericId(r);
    return id != null && selectedIds.has(id);
  });

  const toggleRow = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleIds));
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedRows.length || (!onBulkDelete && !onDelete)) return;
    setBulkBusy(true);
    try {
      if (onBulkDelete) {
        await onBulkDelete(selectedRows);
      }
      setSelectedIds(new Set());
    } finally {
      setBulkBusy(false);
    }
  };

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700 py-10 text-center">
        <p className="text-sm text-slate-500">No records yet.</p>
        <p className="mt-1 text-xs text-slate-600">Use the "Seed demo" button above or add entries manually.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {selectable && (
        <BulkActionsBar
          selectedCount={selectedCount}
          onClear={() => setSelectedIds(new Set())}
          onBulkDelete={handleBulkDelete}
          bulkDeleting={bulkBusy}
        />
      )}
      {csvFilename && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => exportCsv(rows, columns, csvFilename)}>Export CSV</Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-xs uppercase text-slate-500">
            <tr>
              {hdrs.map((h, colIdx) => (
                <th key={h} className="whitespace-nowrap px-3 py-2">
                  {selectable && colIdx === 0 ? (
                    <div className="flex items-center gap-2">
                      <SelectAllCheckbox
                        checked={allSelected}
                        indeterminate={someSelected && !allSelected}
                        onChange={toggleAll}
                        totalCount={visibleIds.length}
                      />
                      <span>{h}</span>
                    </div>
                  ) : (
                    h
                  )}
                </th>
              ))}
              {showActions && <th className="px-3 py-2">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const id = rowNumericId(row);
              const checked = id != null && selectedIds.has(id);
              return (
                <tr
                  key={row.id != null ? String(row.id) : i}
                  className={`border-t border-slate-800 text-slate-300 transition-colors hover:bg-slate-800/40 ${checked ? 'bg-blue-950/25' : ''}`}
                >
                  {columns.map((c, colIdx) => {
                    const v = row[c];
                    if (selectable && colIdx === 0) {
                      return (
                        <td key={c} className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {id != null && (
                              <input
                                type="checkbox"
                                className={rowCheckboxClass}
                                checked={checked}
                                onChange={() => toggleRow(id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                            <span className="tabular-nums text-slate-400">{v == null ? '—' : String(v)}</span>
                          </div>
                        </td>
                      );
                    }
                    if (c === 'isActive') return <td key={c} className="px-3 py-2"><Pill label={v ? 'Active' : 'Inactive'} variant={v ? 'green' : 'red'} /></td>;
                    if (c === 'isRiskZone') return <td key={c} className="px-3 py-2">{v ? <Pill label="Risk" variant="amber" /> : <span className="text-slate-600">—</span>}</td>;
                    return <td key={c} className="max-w-[180px] truncate px-3 py-2">{v == null ? '—' : String(v)}</td>;
                  })}
                  {showActions && (
                    <td className="space-x-2 px-3 py-2 whitespace-nowrap">
                      {onEdit && <button type="button" onClick={() => onEdit(row)} className="text-xs text-sky-400 hover:underline">Edit</button>}
                      {onDelete && (
                        <button type="button" onClick={() => onDelete(row)} className="text-xs text-red-400 hover:underline">
                          Delete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Panel wrapper ─────────────────────────────────────────────────────────────
function Panel({ title, description, count, onAdd, addLabel = '+ Add', search, onSearch, children }: {
  title: string; description: string; count?: number; onAdd?: () => void; addLabel?: string;
  search: string; onSearch: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            {title}
            {count != null && (
              <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">{count}</span>
            )}
          </h2>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <div className="flex gap-2">
          <SearchInput value={search} onChange={onSearch} />
          {onAdd && <Button size="sm" onClick={onAdd}>{addLabel}</Button>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Setup health banner ───────────────────────────────────────────────────────
function SetupHealthBanner() {
  const { data } = useSetupHealth();
  const health = data as { completionPercent?: number; missing?: string[] } | undefined;
  if (!health) return null;
  const missing = health.missing ?? [];
  const completion = Number(health.completionPercent ?? 0);
  const isReady = missing.length === 0;
  if (isReady) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-800/40 bg-green-950/20 px-4 py-2 text-xs text-green-300">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Foundation setup complete - 100% readiness. Intelligence modules can now run.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-amber-800/40 bg-amber-950/15 px-4 py-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="flex-1">
          <p className="text-xs font-medium text-amber-300">{completion}% setup complete - some intelligence modules may not work yet.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {missing.map((item) => (
              <span key={item} className="flex items-center gap-1 text-xs text-slate-500">
                ○ {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SITES ────────────────────────────────────────────────────────────────────
function SitesTab() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useSites();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ name: '', address: '', isActive: true });
  const [err, setErr] = useState('');
  const create = useMutation({
    mutationFn: (b: unknown) => schoolApiPost('/api/sites', b),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-sites', ORG_ID] });
      setOpen(false);
    },
    onError: (e: Error) => setErr(e.message),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { name: string; address: string; isActive: boolean } }) =>
      schoolApiPatch(`/api/sites/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-sites', ORG_ID] });
      setOpen(false);
    },
    onError: (e: Error) => setErr(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => schoolApiDelete(`/api/sites/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-sites', ORG_ID] });
      void qc.invalidateQueries({ queryKey: ['sm-buildings-all'] });
      void qc.invalidateQueries({ queryKey: ['sm-floors-all'] });
      void qc.invalidateQueries({ queryKey: ['sm-zones-all'] });
      void qc.invalidateQueries({ queryKey: ['sm-rooms', ORG_ID] });
    },
    onError: (e: Error) => window.alert(e.message),
  });
  const confirmDeleteSite = (r: Row) => {
    if (!window.confirm(`Delete site "${String(r.name)}" and all buildings, floors, zones, and rooms under it? This cannot be undone.`)) return;
    remove.mutate(Number(r.id));
  };
  const openNew = () => { setEditing(null); setForm({ name: '', address: '', isActive: true }); setErr(''); setOpen(true); };
  const openEdit = (r: Row) => { setEditing(r); setForm({ name: String(r.name ?? ''), address: String(r.address ?? ''), isActive: Boolean(r.isActive) }); setErr(''); setOpen(true); };
  const rows = (Array.isArray(data) ? data : []).filter((r: Row) => String(r.name ?? '').toLowerCase().includes(search.toLowerCase()));
  return (
    <Panel title="Sites" description="Top-level campus sites." count={rows.length} search={search} onSearch={setSearch} onAdd={openNew} addLabel="+ Add Site">
      {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : (
        <ETable
          columns={['id', 'name', 'address', 'isActive']}
          labels={['ID', 'Name', 'Address', 'Status']}
          rows={rows}
          onEdit={openEdit}
          onDelete={confirmDeleteSite}
          onBulkDelete={async (selected) => {
            const { ok, failed } = await runBulkDelete(
              selected,
              `Delete ${selected.length} site(s) and all buildings, floors, zones, and rooms under them? This cannot be undone.`,
              (id) => schoolApiDelete(`/api/sites/${id}`),
            );
            if (ok) {
              void qc.invalidateQueries({ queryKey: ['sm-sites', ORG_ID] });
              void qc.invalidateQueries({ queryKey: ['sm-buildings-all'] });
              void qc.invalidateQueries({ queryKey: ['sm-floors-all'] });
              void qc.invalidateQueries({ queryKey: ['sm-zones-all'] });
              void qc.invalidateQueries({ queryKey: ['sm-rooms', ORG_ID] });
            }
            if (failed.length) window.alert(`Some deletes failed:\n${failed.join('\n')}`);
          }}
          csvFilename="sites.csv"
        />
      )}
      <Sheet open={open} onClose={() => setOpen(false)}>
        <SHdr title={editing ? 'Edit Site' : 'New Site'} onClose={() => setOpen(false)} />
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <FormField label="Site name *" error={err}><FInput value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Main Campus" /></FormField>
          <FormField label="Address"><FInput value={form.address} onChange={(v) => setForm((f) => ({ ...f, address: v }))} placeholder="123 School Rd…" /></FormField>
          <FToggle label="Active" checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
        </div>
        <SFoot
          onClose={() => setOpen(false)}
          onSave={() => {
            if (!form.name.trim()) return setErr('Name required');
            setErr('');
            if (editing?.id != null) {
              update.mutate({ id: Number(editing.id), body: form });
            } else {
              create.mutate({ organizationId: ORG_ID, ...form });
            }
          }}
          pending={create.isPending || update.isPending}
          label={editing ? 'Save changes' : 'Create site'}
        />
      </Sheet>
    </Panel>
  );
}

// ─── BUILDINGS ────────────────────────────────────────────────────────────────
function BuildingsTab() {
  const qc = useQueryClient();
  const { data: sites = [] } = useSites();
  const { data = [], isLoading } = useBuildings();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ siteId: '', name: '', isActive: true });
  const [err, setErr] = useState('');
  const siteOpts = (Array.isArray(sites) ? sites : []).map((s: Row) => ({ label: String(s.name), value: s.id as number }));
  const create = useMutation({
    mutationFn: (b: unknown) => schoolApiPost('/api/buildings', b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sm-buildings-all'] }); setOpen(false); },
    onError: (e: Error) => setErr(e.message),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { siteId: number; name: string; isActive: boolean } }) =>
      schoolApiPatch(`/api/buildings/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sm-buildings-all'] }); setOpen(false); },
    onError: (e: Error) => setErr(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => schoolApiDelete(`/api/buildings/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-buildings-all'] });
      void qc.invalidateQueries({ queryKey: ['sm-floors-all'] });
      void qc.invalidateQueries({ queryKey: ['sm-zones-all'] });
      void qc.invalidateQueries({ queryKey: ['sm-rooms', ORG_ID] });
    },
    onError: (e: Error) => window.alert(e.message),
  });
  const confirmDeleteBuilding = (r: Row) => {
    if (!window.confirm(`Delete building "${String(r.name)}" and all floors, zones, and rooms under it?`)) return;
    remove.mutate(Number(r.id));
  };
  const rows = (Array.isArray(data) ? data : []).filter((r: Row) => String(r.name ?? '').toLowerCase().includes(search.toLowerCase()));
  const openNew = () => {
    setEditing(null);
    setForm({ siteId: '', name: '', isActive: true });
    setErr('');
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({
      siteId: String(r.siteId ?? ''),
      name: String(r.name ?? ''),
      isActive: Boolean(r.isActive),
    });
    setErr('');
    setOpen(true);
  };
  const saveBuilding = () => {
    if (!form.siteId) return setErr('Site required');
    if (!form.name.trim()) return setErr('Name required');
    setErr('');
    const body = { siteId: Number(form.siteId), name: form.name, isActive: form.isActive };
    if (editing?.id != null) update.mutate({ id: Number(editing.id), body });
    else create.mutate(body);
  };
  return (
    <Panel title="Buildings" description="Buildings within each site." count={rows.length} search={search} onSearch={setSearch} onAdd={openNew} addLabel="+ Add Building">
      {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : (
        <ETable
          columns={['id', 'siteId', 'name', 'isActive']}
          labels={['ID', 'Site', 'Name', 'Status']}
          rows={rows}
          onEdit={openEdit}
          onDelete={confirmDeleteBuilding}
          onBulkDelete={async (selected) => {
            const { ok, failed } = await runBulkDelete(
              selected,
              `Delete ${selected.length} building(s) and all floors, zones, and rooms under them?`,
              (id) => schoolApiDelete(`/api/buildings/${id}`),
            );
            if (ok) {
              void qc.invalidateQueries({ queryKey: ['sm-buildings-all'] });
              void qc.invalidateQueries({ queryKey: ['sm-floors-all'] });
              void qc.invalidateQueries({ queryKey: ['sm-zones-all'] });
              void qc.invalidateQueries({ queryKey: ['sm-rooms', ORG_ID] });
            }
            if (failed.length) window.alert(`Some deletes failed:\n${failed.join('\n')}`);
          }}
          csvFilename="buildings.csv"
        />
      )}
      <Sheet open={open} onClose={() => setOpen(false)}>
        <SHdr title={editing ? 'Edit Building' : 'New Building'} onClose={() => setOpen(false)} />
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <FormField label="Site *" error={err}><FSelect value={form.siteId} onChange={(v) => setForm((f) => ({ ...f, siteId: v }))} options={siteOpts} /></FormField>
          <FormField label="Building name *"><FInput value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Block A" /></FormField>
          <FToggle label="Active" checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
        </div>
        <SFoot onClose={() => setOpen(false)} onSave={saveBuilding} pending={create.isPending || update.isPending} label={editing ? 'Save changes' : 'Create building'} />
      </Sheet>
    </Panel>
  );
}

// ─── FLOORS ───────────────────────────────────────────────────────────────────
function FloorsTab() {
  const qc = useQueryClient();
  const { data: buildings = [] } = useBuildings();
  const { data = [], isLoading } = useFloors();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ buildingId: '', name: '', levelNo: '0' });
  const [err, setErr] = useState('');
  const bldOpts = (Array.isArray(buildings) ? buildings : []).map((b: Row) => ({ label: String(b.name), value: b.id as number }));
  const create = useMutation({
    mutationFn: (b: unknown) => schoolApiPost('/api/floors', b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sm-floors-all'] }); setOpen(false); },
    onError: (e: Error) => setErr(e.message),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { buildingId: number; name: string; levelNo: number } }) =>
      schoolApiPatch(`/api/floors/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sm-floors-all'] }); setOpen(false); },
    onError: (e: Error) => setErr(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => schoolApiDelete(`/api/floors/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-floors-all'] });
      void qc.invalidateQueries({ queryKey: ['sm-zones-all'] });
      void qc.invalidateQueries({ queryKey: ['sm-rooms', ORG_ID] });
    },
    onError: (e: Error) => window.alert(e.message),
  });
  const confirmDeleteFloor = (r: Row) => {
    if (!window.confirm(`Delete floor "${String(r.name)}" and all zones and rooms on it?`)) return;
    remove.mutate(Number(r.id));
  };
  const rows = (Array.isArray(data) ? data : []).filter((r: Row) => String(r.name ?? '').toLowerCase().includes(search.toLowerCase()));
  const openNew = () => {
    setEditing(null);
    setForm({ buildingId: '', name: '', levelNo: '0' });
    setErr('');
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({
      buildingId: String(r.buildingId ?? ''),
      name: String(r.name ?? ''),
      levelNo: String(r.levelNo ?? '0'),
    });
    setErr('');
    setOpen(true);
  };
  const saveFloor = () => {
    if (!form.buildingId) return setErr('Building required');
    if (!form.name.trim()) return setErr('Name required');
    setErr('');
    const body = { buildingId: Number(form.buildingId), name: form.name, levelNo: Number(form.levelNo) };
    if (editing?.id != null) update.mutate({ id: Number(editing.id), body });
    else create.mutate(body);
  };
  return (
    <Panel title="Floors" description="Floors within each building." count={rows.length} search={search} onSearch={setSearch} onAdd={openNew} addLabel="+ Add Floor">
      {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : (
        <ETable
          columns={['id', 'buildingId', 'name', 'levelNo']}
          labels={['ID', 'Building', 'Name', 'Level']}
          rows={rows}
          onEdit={openEdit}
          onDelete={confirmDeleteFloor}
          onBulkDelete={async (selected) => {
            const { ok, failed } = await runBulkDelete(
              selected,
              `Delete ${selected.length} floor(s) and all zones and rooms on them?`,
              (id) => schoolApiDelete(`/api/floors/${id}`),
            );
            if (ok) {
              void qc.invalidateQueries({ queryKey: ['sm-floors-all'] });
              void qc.invalidateQueries({ queryKey: ['sm-zones-all'] });
              void qc.invalidateQueries({ queryKey: ['sm-rooms', ORG_ID] });
            }
            if (failed.length) window.alert(`Some deletes failed:\n${failed.join('\n')}`);
          }}
          csvFilename="floors.csv"
        />
      )}
      <Sheet open={open} onClose={() => setOpen(false)}>
        <SHdr title={editing ? 'Edit Floor' : 'New Floor'} onClose={() => setOpen(false)} />
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <FormField label="Building *" error={err}><FSelect value={form.buildingId} onChange={(v) => setForm((f) => ({ ...f, buildingId: v }))} options={bldOpts} /></FormField>
          <FormField label="Floor name *"><FInput value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Ground Floor" /></FormField>
          <FormField label="Level number"><FInput type="number" value={form.levelNo} onChange={(v) => setForm((f) => ({ ...f, levelNo: v }))} /></FormField>
        </div>
        <SFoot onClose={() => setOpen(false)} onSave={saveFloor} pending={create.isPending || update.isPending} label={editing ? 'Save changes' : 'Create floor'} />
      </Sheet>
    </Panel>
  );
}

// ─── ZONES ────────────────────────────────────────────────────────────────────
const ZONE_TYPES = ['General', 'Classroom', 'Lab', 'Corridor', 'Staircase', 'Gate', 'Playground', 'Library', 'Reception', 'Parking', 'RestrictedZone', 'BusBay', 'FireExit', 'ServerRoom'];
const RISK_CATS = ['Staircase', 'Gate', 'Lab', 'Playground', 'ServerRoom', 'FireExit', 'Restricted', 'Parking', 'BusBay'];

function ZonesTab() {
  const qc = useQueryClient();
  const { data: floors = [] } = useFloors();
  const { data = [], isLoading } = useZones();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ floorId: '', name: '', zoneType: 'General', isRiskZone: false, riskCategory: '', capacity: '' });
  const [err, setErr] = useState('');
  const flrOpts = (Array.isArray(floors) ? floors : []).map((f: Row) => ({ label: String(f.name), value: f.id as number }));
  const create = useMutation({
    mutationFn: (b: unknown) => schoolApiPost('/api/zones', b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sm-zones-all'] }); setOpen(false); },
    onError: (e: Error) => setErr(e.message),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      schoolApiPatch(`/api/zones/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sm-zones-all'] }); setOpen(false); },
    onError: (e: Error) => setErr(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => schoolApiDelete(`/api/zones/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-zones-all'] });
      void qc.invalidateQueries({ queryKey: ['sm-rooms', ORG_ID] });
    },
    onError: (e: Error) => window.alert(e.message),
  });
  const confirmDeleteZone = (r: Row) => {
    if (
      !window.confirm(
        `Delete zone "${String(r.name)}"? Rooms in this zone, duty rosters, and timetable slots will be removed; cameras will be unmapped.`,
      )
    )
      return;
    remove.mutate(Number(r.id));
  };
  const rows = (Array.isArray(data) ? data : []).filter((r: Row) => String(r.name ?? '').toLowerCase().includes(search.toLowerCase()));
  const zonePayload = () => ({
    floorId: form.floorId ? Number(form.floorId) : undefined,
    name: form.name,
    zoneType: form.zoneType,
    isRiskZone: form.isRiskZone,
    riskCategory: form.isRiskZone ? form.riskCategory || undefined : undefined,
    capacity: form.capacity ? Number(form.capacity) : undefined,
  });
  const openNew = () => {
    setEditing(null);
    setForm({ floorId: '', name: '', zoneType: 'General', isRiskZone: false, riskCategory: '', capacity: '' });
    setErr('');
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({
      floorId: String(r.floorId ?? ''),
      name: String(r.name ?? ''),
      zoneType: String(r.zoneType ?? 'General'),
      isRiskZone: Boolean(r.isRiskZone),
      riskCategory: String(r.riskCategory ?? ''),
      capacity: r.capacity != null ? String(r.capacity) : '',
    });
    setErr('');
    setOpen(true);
  };
  const saveZone = () => {
    if (!form.name.trim()) return setErr('Name required');
    setErr('');
    const body = zonePayload();
    if (editing?.id != null) update.mutate({ id: Number(editing.id), body });
    else create.mutate(body);
  };
  return (
    <Panel title="Zones" description="Areas within floors. Flag risk zones for safety tracking." count={rows.length} search={search} onSearch={setSearch} onAdd={openNew} addLabel="+ Add Zone">
      {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : (
        <ETable
          columns={['id', 'floorId', 'name', 'zoneType', 'isRiskZone', 'riskCategory', 'capacity']}
          labels={['ID', 'Floor', 'Name', 'Type', 'Risk?', 'Risk Cat.', 'Cap.']}
          rows={rows}
          onEdit={openEdit}
          onDelete={confirmDeleteZone}
          onBulkDelete={async (selected) => {
            const { ok, failed } = await runBulkDelete(
              selected,
              `Delete ${selected.length} zone(s)? Rooms, timetable slots, and duty rosters under them will be removed; cameras unmapped.`,
              (id) => schoolApiDelete(`/api/zones/${id}`),
            );
            if (ok) {
              void qc.invalidateQueries({ queryKey: ['sm-zones-all'] });
              void qc.invalidateQueries({ queryKey: ['sm-rooms', ORG_ID] });
              void qc.invalidateQueries({ queryKey: ['sm-timetable'] });
              void qc.invalidateQueries({ queryKey: ['sm-roster'] });
              void qc.invalidateQueries({ queryKey: ['sm-cameras'] });
            }
            if (failed.length) window.alert(`Some deletes failed:\n${failed.join('\n')}`);
          }}
          csvFilename="zones.csv"
        />
      )}
      <Sheet open={open} onClose={() => setOpen(false)}>
        <SHdr title={editing ? 'Edit Zone' : 'New Zone'} onClose={() => setOpen(false)} />
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <FormField label="Floor (optional)"><FSelect value={form.floorId} onChange={(v) => setForm((f) => ({ ...f, floorId: v }))} options={flrOpts} /></FormField>
          <FormField label="Zone name *" error={err}><FInput value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="North Wing" /></FormField>
          <FormField label="Zone type"><FSelect value={form.zoneType} onChange={(v) => setForm((f) => ({ ...f, zoneType: v }))} options={ZONE_TYPES.map((t) => ({ label: t, value: t }))} /></FormField>
          <FToggle label="Risk zone" checked={form.isRiskZone} onChange={(v) => setForm((f) => ({ ...f, isRiskZone: v }))} />
          {form.isRiskZone && <FormField label="Risk category"><FSelect value={form.riskCategory} onChange={(v) => setForm((f) => ({ ...f, riskCategory: v }))} options={RISK_CATS.map((c) => ({ label: c, value: c }))} /></FormField>}
          <FormField label="Capacity (optional)"><FInput type="number" value={form.capacity} onChange={(v) => setForm((f) => ({ ...f, capacity: v }))} placeholder="—" /></FormField>
        </div>
        <SFoot onClose={() => setOpen(false)} onSave={saveZone} pending={create.isPending || update.isPending} label={editing ? 'Save changes' : 'Create zone'} />
      </Sheet>
    </Panel>
  );
}

// ─── ROOMS ────────────────────────────────────────────────────────────────────
const ROOM_TYPES = ['Classroom', 'Lab', 'Library', 'Hall', 'Office', 'Reception', 'StaffRoom', 'Storeroom'];

function RoomsTab() {
  const qc = useQueryClient();
  const { data: zones = [] } = useZones();
  const { data = [], isLoading } = useRooms();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ zoneId: '', roomCode: '', roomName: '', roomType: 'Classroom', capacity: '30', isActive: true });
  const [err, setErr] = useState('');
  const zoneOpts = (Array.isArray(zones) ? zones : []).map((z: Row) => ({ label: String(z.name), value: z.id as number }));
  const create = useMutation({
    mutationFn: (b: unknown) => schoolApiPost('/api/rooms', b),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-rooms', ORG_ID] });
      setOpen(false);
    },
    onError: (e: Error) => setErr(e.message),
  });
  const update = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: {
        zoneId?: number;
        roomCode: string;
        roomName: string;
        roomType: string;
        capacity: number;
        isActive: boolean;
      };
    }) => schoolApiPatch(`/api/rooms/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-rooms', ORG_ID] });
      void qc.invalidateQueries({ queryKey: ['sm-setup-health'] });
      setOpen(false);
    },
    onError: (e: Error) => setErr(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => schoolApiDelete(`/api/rooms/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-rooms', ORG_ID] });
      void qc.invalidateQueries({ queryKey: ['sm-setup-health'] });
    },
    onError: (e: Error) => window.alert(e.message),
  });
  const confirmDeleteRoom = (r: Row) => {
    if (
      !window.confirm(
        `Delete room "${String(r.roomName ?? r.roomCode)}"? Timetable slots for this room will be removed and cameras unmapped.`,
      )
    )
      return;
    remove.mutate(Number(r.id));
  };
  const rows = (Array.isArray(data) ? data : []).filter((r: Row) =>
    String(r.roomName ?? '').toLowerCase().includes(search.toLowerCase()) ||
    String(r.roomCode ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const openNew = () => {
    setEditing(null);
    setForm({ zoneId: '', roomCode: '', roomName: '', roomType: 'Classroom', capacity: '30', isActive: true });
    setErr('');
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({
      zoneId: String(r.zoneId ?? ''),
      roomCode: String(r.roomCode ?? ''),
      roomName: String(r.roomName ?? ''),
      roomType: String(r.roomType ?? 'Classroom'),
      capacity: String(r.capacity ?? '30'),
      isActive: Boolean(r.isActive),
    });
    setErr('');
    setOpen(true);
  };
  const saveRoom = () => {
    if (!form.roomCode.trim()) return setErr('Code required');
    if (!form.roomName.trim()) return setErr('Name required');
    if (Number(form.capacity) < 1) return setErr('Capacity must be ≥ 1');
    setErr('');
    const body = {
      zoneId: form.zoneId ? Number(form.zoneId) : undefined,
      roomCode: form.roomCode,
      roomName: form.roomName,
      roomType: form.roomType,
      capacity: Number(form.capacity),
      isActive: form.isActive,
    };
    if (editing?.id != null) update.mutate({ id: Number(editing.id), body });
    else create.mutate(body);
  };
  return (
    <Panel title="Rooms" description="Classrooms, labs, libraries, halls. Capacity ≥ 1 enforced." count={rows.length} search={search} onSearch={setSearch} onAdd={openNew} addLabel="+ Add Room">
      {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : (
        <ETable
          columns={['id', 'roomCode', 'roomName', 'roomType', 'capacity', 'isActive']}
          labels={['ID', 'Code', 'Name', 'Type', 'Cap.', 'Status']}
          rows={rows}
          onEdit={openEdit}
          onDelete={confirmDeleteRoom}
          onBulkDelete={async (selected) => {
            const { ok, failed } = await runBulkDelete(
              selected,
              `Delete ${selected.length} room(s)? Timetable slots for these rooms will be removed and cameras will be unmapped from them.`,
              (id) => schoolApiDelete(`/api/rooms/${id}`),
            );
            if (ok) {
              void qc.invalidateQueries({ queryKey: ['sm-rooms', ORG_ID] });
              void qc.invalidateQueries({ queryKey: ['sm-setup-health'] });
              void qc.invalidateQueries({ queryKey: ['sm-timetable'] });
              void qc.invalidateQueries({ queryKey: ['sm-cameras'] });
            }
            if (failed.length) window.alert(`Some deletes failed:\n${failed.join('\n')}`);
          }}
          csvFilename="rooms.csv"
        />
      )}
      <Sheet open={open} onClose={() => setOpen(false)}>
        <SHdr title={editing ? 'Edit Room' : 'New Room'} onClose={() => setOpen(false)} />
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <FormField label="Zone (optional)"><FSelect value={form.zoneId} onChange={(v) => setForm((f) => ({ ...f, zoneId: v }))} options={zoneOpts} /></FormField>
          <FormField label="Room code *" error={err}><FInput value={form.roomCode} onChange={(v) => setForm((f) => ({ ...f, roomCode: v }))} placeholder="R-101" /></FormField>
          <FormField label="Room name *"><FInput value={form.roomName} onChange={(v) => setForm((f) => ({ ...f, roomName: v }))} placeholder="Room 101" /></FormField>
          <FormField label="Room type"><FSelect value={form.roomType} onChange={(v) => setForm((f) => ({ ...f, roomType: v }))} options={ROOM_TYPES.map((t) => ({ label: t, value: t }))} /></FormField>
          <FormField label="Capacity * (≥ 1)"><FInput type="number" value={form.capacity} onChange={(v) => setForm((f) => ({ ...f, capacity: v }))} /></FormField>
          <FToggle label="Active" checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
        </div>
        <SFoot onClose={() => setOpen(false)} onSave={saveRoom} pending={create.isPending || update.isPending} label={editing ? 'Save changes' : 'Create room'} />
      </Sheet>
    </Panel>
  );
}

// ─── CLASSES & SECTIONS ───────────────────────────────────────────────────────
function SectionRoomMapRow({ sectionId, sectionName, rooms }: { sectionId: number; sectionName: string; rooms: Row[] }) {
  const [roomId, setRoomId] = useState('');
  const [label, setLabel] = useState('…');
  useEffect(() => {
    void fetch(`/api/sections/${sectionId}/room-mapping`).then((r) => r.json()).then((j) => {
      const rid = j?.mapping?.roomId ?? j?.room?.id;
      if (rid) { setRoomId(String(rid)); setLabel(String(j?.room?.roomCode ?? j?.room?.roomName ?? rid)); }
      else setLabel('Unmapped');
    });
  }, [sectionId]);
  const save = () => {
    if (!roomId) return;
    void fetch(`/api/sections/${sectionId}/room-mapping`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ roomId: Number(roomId) }),
    }).then(() => fetch(`/api/sections/${sectionId}/room-mapping`).then((r) => r.json()).then((j) => setLabel(String(j?.room?.roomCode ?? roomId))));
  };
  const opts = (Array.isArray(rooms) ? rooms : []).map((r) => ({ label: String(r.roomCode ?? r.roomName ?? r.id), value: String(r.id) }));
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 py-1.5 text-xs text-slate-400">
      <span className="w-20 font-medium text-slate-300">{sectionName}</span>
      <span className="text-slate-500">→ {label}</span>
      <select
        className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 text-slate-200"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
      >
        <option value="">Room…</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button type="button" className="text-sky-400 hover:underline" onClick={save}>Save</button>
    </div>
  );
}

function ClassesSectionsTab() {
  const qc = useQueryClient();
  const { data: classes = [], isLoading } = useClasses();
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState<Row | null>(null);
  const [openC, setOpenC] = useState(false);
  const [editingClass, setEditingClass] = useState<Row | null>(null);
  const [cForm, setCForm] = useState({ name: '', sortOrder: '0', isActive: true });
  const [cErr, setCErr] = useState('');
  const [openS, setOpenS] = useState(false);
  const [editingSection, setEditingSection] = useState<Row | null>(null);
  const [sForm, setSForm] = useState({ name: '', expectedStudentCount: '30', isActive: true });
  const [sErr, setSErr] = useState('');
  const [checkedClassIds, setCheckedClassIds] = useState<Set<number>>(new Set());
  const [classBulkBusy, setClassBulkBusy] = useState(false);
  const { data: sections = [] } = useSections(selectedClass?.id as number);
  const { data: rooms = [] } = useRooms();
  const createC = useMutation({
    mutationFn: (b: unknown) => schoolApiPost('/api/classes', b),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-classes', ORG_ID] });
      setOpenC(false);
    },
    onError: (e: Error) => setCErr(e.message),
  });
  const updateC = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { name: string; sortOrder: number; isActive: boolean } }) =>
      schoolApiPatch(`/api/classes/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-classes', ORG_ID] });
      setOpenC(false);
    },
    onError: (e: Error) => setCErr(e.message),
  });
  const createS = useMutation({
    mutationFn: (b: unknown) => schoolApiPost('/api/sections', b),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-sections', selectedClass?.id] });
      setOpenS(false);
    },
    onError: (e: Error) => setSErr(e.message),
  });
  const updateS = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: { name: string; expectedStudentCount: number; isActive: boolean };
    }) => schoolApiPatch(`/api/sections/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-sections', selectedClass?.id] });
      setOpenS(false);
    },
    onError: (e: Error) => setSErr(e.message),
  });
  const removeClass = useMutation({
    mutationFn: (id: number) => schoolApiDelete(`/api/classes/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-classes', ORG_ID] });
      void qc.invalidateQueries({ queryKey: ['sm-sections'] });
      setSelectedClass(null);
    },
    onError: (e: Error) => window.alert(e.message),
  });
  const removeSection = useMutation({
    mutationFn: (id: number) => schoolApiDelete(`/api/sections/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['sm-sections', selectedClass?.id] }); },
    onError: (e: Error) => window.alert(e.message),
  });
  const confirmDeleteClass = (c: Row, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete class "${String(c.name)}" and all its sections?`)) return;
    removeClass.mutate(Number(c.id));
  };
  const confirmDeleteSection = (sec: Row) => {
    if (!window.confirm(`Delete section "${String(sec.name)}"? Timetable rows for this section will be removed.`)) return;
    removeSection.mutate(Number(sec.id));
  };
  const openNewClass = () => {
    setEditingClass(null);
    setCForm({ name: '', sortOrder: '0', isActive: true });
    setCErr('');
    setOpenC(true);
  };
  const openEditClass = (c: Row, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingClass(c);
    setCForm({
      name: String(c.name ?? ''),
      sortOrder: String(c.sortOrder ?? '0'),
      isActive: Boolean(c.isActive),
    });
    setCErr('');
    setOpenC(true);
  };
  const saveClass = () => {
    if (!cForm.name.trim()) return setCErr('Name required');
    setCErr('');
    const body = { name: cForm.name, sortOrder: Number(cForm.sortOrder), isActive: cForm.isActive };
    if (editingClass?.id != null) updateC.mutate({ id: Number(editingClass.id), body });
    else createC.mutate({ organizationId: ORG_ID, ...body });
  };
  const openNewSection = () => {
    setEditingSection(null);
    setSForm({ name: '', expectedStudentCount: '30', isActive: true });
    setSErr('');
    setOpenS(true);
  };
  const openEditSection = (sec: Row) => {
    setEditingSection(sec);
    setSForm({
      name: String(sec.name ?? ''),
      expectedStudentCount: String(sec.expectedStudentCount ?? '30'),
      isActive: Boolean(sec.isActive),
    });
    setSErr('');
    setOpenS(true);
  };
  const saveSection = () => {
    if (!sForm.name.trim()) return setSErr('Name required');
    if (Number(sForm.expectedStudentCount) < 1) return setSErr('Count must be ≥ 1');
    setSErr('');
    const body = {
      name: sForm.name,
      expectedStudentCount: Number(sForm.expectedStudentCount),
      isActive: sForm.isActive,
    };
    if (editingSection?.id != null) updateS.mutate({ id: Number(editingSection.id), body });
    else createS.mutate({ classId: selectedClass?.id, ...body });
  };
  const filteredC = (Array.isArray(classes) ? classes : []).filter((c: Row) =>
    String(c.name ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const classVisibleIds = filteredC.map((c) => rowNumericId(c)).filter((id): id is number => id != null);
  const allClassesChecked = classVisibleIds.length > 0 && classVisibleIds.every((id) => checkedClassIds.has(id));
  const someClassesChecked = classVisibleIds.some((id) => checkedClassIds.has(id));
  const bulkDeleteClasses = async () => {
    const selected = filteredC.filter((c) => {
      const id = rowNumericId(c);
      return id != null && checkedClassIds.has(id);
    });
    setClassBulkBusy(true);
    try {
      const { ok, failed } = await runBulkDelete(
        selected,
        `Delete ${selected.length} class(es) and all their sections?`,
        (id) => schoolApiDelete(`/api/classes/${id}`),
      );
      if (ok) {
        void qc.invalidateQueries({ queryKey: ['sm-classes', ORG_ID] });
        void qc.invalidateQueries({ queryKey: ['sm-sections'] });
        setSelectedClass(null);
        setCheckedClassIds(new Set());
      }
      if (failed.length) window.alert(`Some deletes failed:\n${failed.join('\n')}`);
    } finally {
      setClassBulkBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      <Panel title="Classes" description="Click a class row to manage its sections and room mappings." count={(Array.isArray(classes) ? classes : []).length} search={search} onSearch={setSearch} onAdd={openNewClass} addLabel="+ Add Class">
        {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : (
          <div className="space-y-2">
            <BulkActionsBar
              selectedCount={classVisibleIds.filter((id) => checkedClassIds.has(id)).length}
              onClear={() => setCheckedClassIds(new Set())}
              onBulkDelete={bulkDeleteClasses}
              bulkDeleting={classBulkBusy}
            />
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {filteredC.length > 0 && (
                          <SelectAllCheckbox
                            checked={allClassesChecked}
                            indeterminate={someClassesChecked && !allClassesChecked}
                            onChange={() => setCheckedClassIds(allClassesChecked ? new Set() : new Set(classVisibleIds))}
                            totalCount={classVisibleIds.length}
                          />
                        )}
                        <span>ID</span>
                      </div>
                    </th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Sort</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Sections</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredC.map((c: Row, i: number) => {
                    const cid = rowNumericId(c);
                    const rowChecked = cid != null && checkedClassIds.has(cid);
                    return (
                      <tr
                        key={i}
                        onClick={() => setSelectedClass(selectedClass?.id === c.id ? null : c)}
                        className={`cursor-pointer border-t border-slate-800 text-slate-300 transition-colors ${selectedClass?.id === c.id ? 'bg-blue-900/20' : rowChecked ? 'bg-blue-950/25' : 'hover:bg-slate-800/40'}`}
                      >
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            {cid != null && (
                              <input
                                type="checkbox"
                                className={rowCheckboxClass}
                                checked={rowChecked}
                                onChange={() => {
                                  setCheckedClassIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(cid)) next.delete(cid);
                                    else next.add(cid);
                                    return next;
                                  });
                                }}
                              />
                            )}
                            <span className="tabular-nums text-slate-400">{String(c.id)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-100">{String(c.name)}</td>
                        <td className="px-3 py-2">{String(c.sortOrder ?? 0)}</td>
                        <td className="px-3 py-2"><Pill label={c.isActive ? 'Active' : 'Inactive'} variant={c.isActive ? 'green' : 'red'} /></td>
                        <td className="px-3 py-2 text-xs text-sky-400">{selectedClass?.id === c.id ? '▲ Hide' : '▼ Sections'}</td>
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="text-xs text-sky-400 hover:underline"
                              onClick={(e) => openEditClass(c, e)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-xs text-red-400 hover:underline"
                              onClick={(e) => confirmDeleteClass(c, e)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!filteredC.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-slate-500">No classes yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>

      {selectedClass && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">
              Sections — <span className="text-blue-400">{String(selectedClass.name)}</span>
              <span className="ml-2 rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">{Array.isArray(sections) ? sections.length : 0}</span>
            </h3>
            <Button size="sm" onClick={openNewSection}>+ Add Section</Button>
          </div>
          <ETable
            columns={['id', 'name', 'expectedStudentCount', 'isActive']}
            labels={['ID', 'Section', 'Expected Count', 'Status']}
            rows={Array.isArray(sections) ? sections : []}
            onEdit={openEditSection}
            onDelete={confirmDeleteSection}
            onBulkDelete={async (selected) => {
              const { ok, failed } = await runBulkDelete(
                selected,
                `Delete ${selected.length} section(s)? Timetable rows for these sections will be removed.`,
                (id) => schoolApiDelete(`/api/sections/${id}`),
              );
              if (ok) void qc.invalidateQueries({ queryKey: ['sm-sections', selectedClass?.id] });
              if (failed.length) window.alert(`Some deletes failed:\n${failed.join('\n')}`);
            }}
            csvFilename={`sections-class-${selectedClass.id}.csv`}
          />
          {(Array.isArray(sections) ? sections : []).length > 0 && (
            <div className="border-t border-slate-800 pt-3">
              <p className="mb-2 text-xs font-medium text-slate-500">Section → room mapping (primary classroom)</p>
              {(Array.isArray(sections) ? sections : []).slice(0, 12).map((sec: Row) => (
                <SectionRoomMapRow key={String(sec.id)} sectionId={Number(sec.id)} sectionName={String(sec.name)} rooms={Array.isArray(rooms) ? rooms : []} />
              ))}
            </div>
          )}
        </div>
      )}

      <Sheet open={openC} onClose={() => setOpenC(false)}>
        <SHdr title={editingClass ? 'Edit Class' : 'New Class'} onClose={() => setOpenC(false)} />
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <FormField label="Class name *" error={cErr}><FInput value={cForm.name} onChange={(v) => setCForm((f) => ({ ...f, name: v }))} placeholder="Class 1" /></FormField>
          <FormField label="Sort order"><FInput type="number" value={cForm.sortOrder} onChange={(v) => setCForm((f) => ({ ...f, sortOrder: v }))} /></FormField>
          <FToggle label="Active" checked={cForm.isActive} onChange={(v) => setCForm((f) => ({ ...f, isActive: v }))} />
        </div>
        <SFoot onClose={() => setOpenC(false)} onSave={saveClass} pending={createC.isPending || updateC.isPending} label={editingClass ? 'Save changes' : 'Create class'} />
      </Sheet>

      <Sheet open={openS} onClose={() => setOpenS(false)}>
        <SHdr title={editingSection ? `Edit Section — ${selectedClass?.name}` : `New Section — ${selectedClass?.name}`} onClose={() => setOpenS(false)} />
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <FormField label="Section name *" error={sErr}><FInput value={sForm.name} onChange={(v) => setSForm((f) => ({ ...f, name: v }))} placeholder="A" /></FormField>
          <FormField label="Expected student count *"><FInput type="number" value={sForm.expectedStudentCount} onChange={(v) => setSForm((f) => ({ ...f, expectedStudentCount: v }))} /></FormField>
          <FToggle label="Active" checked={sForm.isActive} onChange={(v) => setSForm((f) => ({ ...f, isActive: v }))} />
        </div>
        <SFoot onClose={() => setOpenS(false)} onSave={saveSection} pending={createS.isPending || updateS.isPending} label={editingSection ? 'Save changes' : 'Create section'} />
      </Sheet>
    </div>
  );
}

// ─── SUBJECTS ─────────────────────────────────────────────────────────────────
function SubjectsTab() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useSubjects();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ name: '', subjectCode: '', isActive: true });
  const [err, setErr] = useState('');
  const create = useMutation({
    mutationFn: (b: unknown) => schoolApiPost('/api/subjects', b),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-subjects', ORG_ID] });
      setOpen(false);
    },
    onError: (e: Error) => setErr(e.message),
  });
  const update = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: { name: string; subjectCode?: string; isActive: boolean };
    }) => schoolApiPatch(`/api/subjects/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-subjects', ORG_ID] });
      setOpen(false);
    },
    onError: (e: Error) => setErr(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => schoolApiDelete(`/api/subjects/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['sm-subjects', ORG_ID] }); },
    onError: (e: Error) => window.alert(e.message),
  });
  const confirmDeleteSubject = (r: Row) => {
    if (!window.confirm(`Delete subject "${String(r.name)}"? Timetable rows using this subject will be removed.`)) return;
    remove.mutate(Number(r.id));
  };
  const rows = (Array.isArray(data) ? data : []).filter((r: Row) =>
    String(r.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    String(r.subjectCode ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const openNew = () => {
    setEditing(null);
    setForm({ name: '', subjectCode: '', isActive: true });
    setErr('');
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({
      name: String(r.name ?? ''),
      subjectCode: String(r.subjectCode ?? ''),
      isActive: Boolean(r.isActive),
    });
    setErr('');
    setOpen(true);
  };
  const saveSubject = () => {
    if (!form.name.trim()) return setErr('Name required');
    setErr('');
    const body = { name: form.name, subjectCode: form.subjectCode || undefined, isActive: form.isActive };
    if (editing?.id != null) update.mutate({ id: Number(editing.id), body });
    else create.mutate({ organizationId: ORG_ID, ...body });
  };
  return (
    <Panel title="Subjects" description="Subjects taught — referenced by the timetable." count={rows.length} search={search} onSearch={setSearch} onAdd={openNew} addLabel="+ Add Subject">
      {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : (
        <ETable
          columns={['id', 'subjectCode', 'name', 'isActive']}
          labels={['ID', 'Code', 'Subject name', 'Status']}
          rows={rows}
          onEdit={openEdit}
          onDelete={confirmDeleteSubject}
          onBulkDelete={async (selected) => {
            const { ok, failed } = await runBulkDelete(
              selected,
              `Delete ${selected.length} subject(s)? Timetable rows using them will be removed.`,
              (id) => schoolApiDelete(`/api/subjects/${id}`),
            );
            if (ok) void qc.invalidateQueries({ queryKey: ['sm-subjects', ORG_ID] });
            if (failed.length) window.alert(`Some deletes failed:\n${failed.join('\n')}`);
          }}
          csvFilename="subjects.csv"
        />
      )}
      <Sheet open={open} onClose={() => setOpen(false)}>
        <SHdr title={editing ? 'Edit Subject' : 'New Subject'} onClose={() => setOpen(false)} />
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <FormField label="Subject name *" error={err}><FInput value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Mathematics" /></FormField>
          <FormField label="Subject code"><FInput value={form.subjectCode} onChange={(v) => setForm((f) => ({ ...f, subjectCode: v }))} placeholder="MATH-01" /></FormField>
          <FToggle label="Active" checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
        </div>
        <SFoot onClose={() => setOpen(false)} onSave={saveSubject} pending={create.isPending || update.isPending} label={editing ? 'Save changes' : 'Create subject'} />
      </Sheet>
    </Panel>
  );
}

// ─── TEACHERS ─────────────────────────────────────────────────────────────────
function TeachersTab() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useTeachers();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ employeeCode: '', name: '', email: '', phone: '', isActive: true });
  const [err, setErr] = useState('');
  const create = useMutation({
    mutationFn: (b: unknown) => schoolApiPost('/api/teachers', b),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-teachers', ORG_ID] });
      setOpen(false);
    },
    onError: (e: Error) => setErr(e.message),
  });
  const update = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: { employeeCode?: string; name: string; email?: string; phone?: string; isActive: boolean };
    }) => schoolApiPatch(`/api/teachers/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-teachers', ORG_ID] });
      setOpen(false);
    },
    onError: (e: Error) => setErr(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => schoolApiDelete(`/api/teachers/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['sm-teachers', ORG_ID] }); },
    onError: (e: Error) => window.alert(e.message),
  });
  const confirmDeleteTeacher = (r: Row) => {
    if (!window.confirm(`Delete teacher "${String(r.name)}"? Their timetable slots will be removed.`)) return;
    remove.mutate(Number(r.id));
  };
  const rows = (Array.isArray(data) ? data : []).filter((r: Row) =>
    String(r.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    String(r.employeeCode ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const openNew = () => {
    setEditing(null);
    setForm({ employeeCode: '', name: '', email: '', phone: '', isActive: true });
    setErr('');
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({
      employeeCode: String(r.employeeCode ?? ''),
      name: String(r.name ?? ''),
      email: String(r.email ?? ''),
      phone: String(r.phone ?? ''),
      isActive: Boolean(r.isActive),
    });
    setErr('');
    setOpen(true);
  };
  const saveTeacher = () => {
    if (!form.name.trim()) return setErr('Name required');
    setErr('');
    const body = {
      employeeCode: form.employeeCode || undefined,
      name: form.name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      isActive: form.isActive,
    };
    if (editing?.id != null) update.mutate({ id: Number(editing.id), body });
    else create.mutate({ organizationId: ORG_ID, ...body });
  };
  return (
    <Panel title="Teachers" description="Teaching staff referenced by the timetable." count={rows.length} search={search} onSearch={setSearch} onAdd={openNew} addLabel="+ Add Teacher">
      {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : (
        <ETable
          columns={['id', 'employeeCode', 'name', 'email', 'phone', 'isActive']}
          labels={['ID', 'Code', 'Name', 'Email', 'Phone', 'Status']}
          rows={rows}
          onEdit={openEdit}
          onDelete={confirmDeleteTeacher}
          onBulkDelete={async (selected) => {
            const { ok, failed } = await runBulkDelete(
              selected,
              `Delete ${selected.length} teacher(s)? Their timetable slots will be removed.`,
              (id) => schoolApiDelete(`/api/teachers/${id}`),
            );
            if (ok) void qc.invalidateQueries({ queryKey: ['sm-teachers', ORG_ID] });
            if (failed.length) window.alert(`Some deletes failed:\n${failed.join('\n')}`);
          }}
          csvFilename="teachers.csv"
        />
      )}
      <Sheet open={open} onClose={() => setOpen(false)}>
        <SHdr title={editing ? 'Edit Teacher' : 'New Teacher'} onClose={() => setOpen(false)} />
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <FormField label="Employee code"><FInput value={form.employeeCode} onChange={(v) => setForm((f) => ({ ...f, employeeCode: v }))} placeholder="EMP-001" /></FormField>
          <FormField label="Full name *" error={err}><FInput value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Ms. Patel" /></FormField>
          <FormField label="Email"><FInput type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="teacher@school.edu" /></FormField>
          <FormField label="Phone"><FInput value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="+91 98765 43210" /></FormField>
          <FToggle label="Active" checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
        </div>
        <SFoot onClose={() => setOpen(false)} onSave={saveTeacher} pending={create.isPending || update.isPending} label={editing ? 'Save changes' : 'Create teacher'} />
      </Sheet>
    </Panel>
  );
}

// ─── STAFF ────────────────────────────────────────────────────────────────────
const STAFF_ROLES = ['Security', 'Admin', 'GateStaff', 'Peon', 'Librarian', 'Lab Assistant', 'Sports Coach', 'Counselor', 'Receptionist', 'Driver', 'Cleaner'];

function StaffTab() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useStaff();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ employeeCode: '', name: '', role: 'Security', phone: '', isActive: true });
  const [err, setErr] = useState('');
  const create = useMutation({
    mutationFn: (b: unknown) => schoolApiPost('/api/staff-members', b),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-staff', ORG_ID] });
      setOpen(false);
    },
    onError: (e: Error) => setErr(e.message),
  });
  const update = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: { employeeCode?: string; name: string; role: string; phone?: string; isActive: boolean };
    }) => schoolApiPatch(`/api/staff-members/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-staff', ORG_ID] });
      setOpen(false);
    },
    onError: (e: Error) => setErr(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => schoolApiDelete(`/api/staff-members/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['sm-staff', ORG_ID] }); },
    onError: (e: Error) => window.alert(e.message),
  });
  const confirmDeleteStaff = (r: Row) => {
    if (!window.confirm(`Delete staff "${String(r.name)}"? Their duty roster rows will be removed.`)) return;
    remove.mutate(Number(r.id));
  };
  const rows = (Array.isArray(data) ? data : []).filter((r: Row) =>
    String(r.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    String(r.role ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const openNew = () => {
    setEditing(null);
    setForm({ employeeCode: '', name: '', role: 'Security', phone: '', isActive: true });
    setErr('');
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({
      employeeCode: String(r.employeeCode ?? ''),
      name: String(r.name ?? ''),
      role: String(r.role ?? 'Security'),
      phone: String(r.phone ?? ''),
      isActive: Boolean(r.isActive),
    });
    setErr('');
    setOpen(true);
  };
  const saveStaff = () => {
    if (!form.name.trim()) return setErr('Name required');
    if (!form.role.trim()) return setErr('Role required');
    setErr('');
    const body = {
      employeeCode: form.employeeCode || undefined,
      name: form.name,
      role: form.role,
      phone: form.phone || undefined,
      isActive: form.isActive,
    };
    if (editing?.id != null) update.mutate({ id: Number(editing.id), body });
    else create.mutate({ organizationId: ORG_ID, ...body });
  };
  return (
    <Panel title="Staff Members" description="Non-teaching staff: gate, lab, reception, security, and more." count={rows.length} search={search} onSearch={setSearch} onAdd={openNew} addLabel="+ Add Staff">
      {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : (
        <ETable
          columns={['id', 'employeeCode', 'name', 'role', 'phone', 'isActive']}
          labels={['ID', 'Code', 'Name', 'Role', 'Phone', 'Status']}
          rows={rows}
          onEdit={openEdit}
          onDelete={confirmDeleteStaff}
          onBulkDelete={async (selected) => {
            const { ok, failed } = await runBulkDelete(
              selected,
              `Delete ${selected.length} staff member(s)? Their duty roster rows will be removed.`,
              (id) => schoolApiDelete(`/api/staff-members/${id}`),
            );
            if (ok) void qc.invalidateQueries({ queryKey: ['sm-staff', ORG_ID] });
            if (failed.length) window.alert(`Some deletes failed:\n${failed.join('\n')}`);
          }}
          csvFilename="staff.csv"
        />
      )}
      <Sheet open={open} onClose={() => setOpen(false)}>
        <SHdr title={editing ? 'Edit Staff Member' : 'New Staff Member'} onClose={() => setOpen(false)} />
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <FormField label="Employee code"><FInput value={form.employeeCode} onChange={(v) => setForm((f) => ({ ...f, employeeCode: v }))} placeholder="STF-001" /></FormField>
          <FormField label="Full name *" error={err}><FInput value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Ramesh Kumar" /></FormField>
          <FormField label="Role *"><FSelect value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))} options={STAFF_ROLES.map((r) => ({ label: r, value: r }))} /></FormField>
          <FormField label="Phone"><FInput value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="+91 98765 43210" /></FormField>
          <FToggle label="Active" checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
        </div>
        <SFoot onClose={() => setOpen(false)} onSave={saveStaff} pending={create.isPending || update.isPending} label={editing ? 'Save changes' : 'Create staff'} />
      </Sheet>
    </Panel>
  );
}

// ─── CAMPUS TREE ──────────────────────────────────────────────────────────────
function CampusTreeTab() {
  const { data: sites = [] } = useSites();
  const { data: buildings = [] } = useBuildings();
  const { data: floors = [] } = useFloors();
  const { data: zones = [] } = useZones();
  const { data: rooms = [] } = useRooms();
  return (
    <CampusTreeView
      sites={Array.isArray(sites) ? sites : []}
      buildings={Array.isArray(buildings) ? buildings : []}
      floors={Array.isArray(floors) ? floors : []}
      zones={Array.isArray(zones) ? zones : []}
      rooms={Array.isArray(rooms) ? rooms : []}
    />
  );
}

// ─── SEED BUTTON ──────────────────────────────────────────────────────────────
function SeedButton() {
  const qc = useQueryClient();
  const seed = useSeedDemo();
  const [done, setDone] = useState(false);
  function handleSeed() {
    seed.mutate(undefined, {
      onSuccess: () => {
        ALL_QUERY_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: key }));
        setDone(true);
        setTimeout(() => setDone(false), 3000);
      },
      onError: (e: Error) => window.alert(e.message || 'Seed failed'),
    });
  }
  if (done) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-400">
        <CheckCircle2 className="h-4 w-4" /> Demo data seeded — all tabs refreshed
      </div>
    );
  }
  return (
    <Button size="sm" variant="outline" onClick={handleSeed} disabled={seed.isPending} className="border-slate-600">
      {seed.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Database className="mr-1.5 h-3.5 w-3.5" />}
      {seed.isPending ? 'Seeding…' : 'Seed demo data'}
    </Button>
  );
}

// ─── TAB DEFINITIONS ─────────────────────────────────────────────────────────
const TABS = [
  { id: 'sites',     label: 'Sites',             component: SitesTab },
  { id: 'buildings', label: 'Buildings',          component: BuildingsTab },
  { id: 'floors',    label: 'Floors',             component: FloorsTab },
  { id: 'zones',     label: 'Zones',              component: ZonesTab },
  { id: 'rooms',     label: 'Rooms',              component: RoomsTab },
  { id: 'classes',   label: 'Classes & Sections', component: ClassesSectionsTab },
  { id: 'subjects',  label: 'Subjects',           component: SubjectsTab },
  { id: 'teachers',  label: 'Teachers',           component: TeachersTab },
  { id: 'staff',     label: 'Staff',              component: StaffTab },
  { id: 'tree',      label: 'Campus Tree',        component: CampusTreeTab },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<TabId>('sites');
  const ActiveComponent = useMemo(() => TABS.find((t) => t.id === activeTab)?.component ?? SitesTab, [activeTab]);

  return (
    <div className="space-y-5">
      <SMPageHeader
        title="Master Data"
        subtitle="Campus hierarchy, rooms, classes, subjects, teachers, and staff — foundation for all intelligence modules."
        action={<div className="flex items-center gap-2"><BulkImportButton /><SeedButton /></div>}
      />

      <SetupHealthBanner />

      {/* Tab bar */}
      <div className="flex gap-0.5 overflow-x-auto border-b border-slate-800 pb-0 scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors -mb-px ${
              activeTab === t.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      <div className="min-h-[400px]">
        <ActiveComponent />
      </div>
    </div>
  );
}
