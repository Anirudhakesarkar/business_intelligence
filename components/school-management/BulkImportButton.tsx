'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  Download,
  X,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  FileSpreadsheet,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EntityResult {
  type: string;
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

interface ImportResponse {
  ok: boolean;
  totalCreated: number;
  totalErrors: number;
  totalSkipped: number;
  results: EntityResult[];
  error?: string;
}

const ALL_QUERY_KEYS = [
  ['sm-sites', 1],
  ['sm-buildings-all'],
  ['sm-floors-all'],
  ['sm-zones-all'],
  ['sm-rooms', 1],
  ['sm-classes', 1],
  ['sm-subjects', 1],
  ['sm-teachers', 1],
  ['sm-staff', 1],
  ['sm-setup-health'],
];

const ENTITY_ORDER = [
  'site',
  'building',
  'floor',
  'zone',
  'room',
  'class',
  'section',
  'subject',
  'teacher',
  'staff',
] as const;

const TYPE_LABELS: Record<string, string> = {
  site: 'Sites',
  building: 'Buildings',
  floor: 'Floors',
  zone: 'Zones',
  room: 'Rooms',
  class: 'Classes',
  section: 'Sections',
  subject: 'Subjects',
  teacher: 'Teachers',
  staff: 'Staff',
};

const CSV_FORMAT_ROWS: [string, string][] = [
  ['site', 'name, address'],
  ['building', 'name, site_name'],
  ['floor', 'name, building_name, level_no'],
  ['zone', 'name, floor_name, zone_type'],
  ['room', 'room_code, room_name, zone_name, capacity'],
  ['class', 'name, sort_order'],
  ['section', 'name, class_name, expected_student_count'],
  ['subject', 'name, subject_code'],
  ['teacher', 'name, employee_code, email, phone'],
  ['staff', 'name, employee_code, role, phone'],
];

const TEMPLATE_CSV = `type,name,address,is_active,site_name,building_name,floor_name,level_no,zone_name,zone_type,is_risk_zone,risk_category,capacity,room_code,room_name,room_type,sort_order,class_name,expected_student_count,subject_code,employee_code,email,phone,role
site,Main Campus,123 School Road,true,,,,,,,,,,,,,,,,,,,
building,Block A,,true,Main Campus,,,,,,,,,,,,,,,,,,
floor,Ground Floor,,true,Main Campus,Block A,,0,,,,,,,,,,,,,,,,
zone,Zone A-GF,,true,Main Campus,Block A,Ground Floor,,Classroom,false,,,30,,,,,,,,,,,
room,,,,,,,,Zone A-GF,,,30,R-101,Room 101,Classroom,,,,,,,,,
class,Grade 1,,,,,,,,,,,,,,,1,,,,,,
section,A,,,,,,,,,,,,,,,,Grade 1,30,,,,,
subject,Mathematics,,,,,,,,,,,,,,,,,,,MATH-01,,,
teacher,Ms. Patel,,,,,,,,,,,,,,,,,,,EMP-T01,teacher@school.edu,+91 9000000001,
staff,Ramesh Kumar,,,,,,,,,,,,,,,,,,,STF-001,,+91 9000000010,Security`;

const scrollStyles =
  'overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgb(71_85_105)_rgb(15_23_42)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded [&::-webkit-scrollbar-track]:bg-slate-950 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-600';

function sortResults(results: EntityResult[]): EntityResult[] {
  const rank = new Map(ENTITY_ORDER.map((t, i) => [t, i]));
  return [...results].sort(
    (a, b) => (rank.get(a.type as (typeof ENTITY_ORDER)[number]) ?? 99) - (rank.get(b.type as (typeof ENTITY_ORDER)[number]) ?? 99),
  );
}

function ResultRow({ result }: { result: EntityResult }) {
  const [open, setOpen] = useState(result.errors.length > 0);
  const label = TYPE_LABELS[result.type] ?? result.type;
  const hasErrors = result.errors.length > 0;
  const hasActivity = result.created > 0 || result.skipped > 0 || hasErrors;

  if (!hasActivity) return null;

  return (
    <div className="rounded-lg border border-slate-700/80 bg-slate-800/40">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
        onClick={() => hasErrors && setOpen((o) => !o)}
        disabled={!hasErrors}
      >
        <span className="min-w-[5.5rem] text-sm font-medium text-slate-200">{label}</span>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
          {result.created > 0 && (
            <span className="inline-flex min-w-[5.5rem] justify-center rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
              +{result.created} created
            </span>
          )}
          {result.skipped > 0 && (
            <span className="inline-flex min-w-[5.5rem] justify-center rounded-md bg-slate-700/80 px-2 py-0.5 text-xs font-medium text-slate-400">
              {result.skipped} skipped
            </span>
          )}
          {hasErrors && (
            <span className="inline-flex min-w-[5.5rem] justify-center rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
              {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {hasErrors && (
          <span className="shrink-0 text-slate-500">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        )}
      </button>
      {open && hasErrors && (
        <div className={`max-h-36 space-y-1 border-t border-slate-700/80 px-3 py-2 ${scrollStyles}`}>
          {result.errors.map((e, i) => (
            <p key={i} className="text-xs leading-relaxed text-red-400/90">
              Row {e.row}: {e.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function ImportGuide({ defaultOpen }: { defaultOpen: boolean }) {
  const [expanded, setExpanded] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Info className="h-4 w-4 text-slate-500" />
          CSV format guide
        </span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
        )}
      </button>
      {expanded && (
        <div className="space-y-2 border-t border-slate-800 px-4 pb-3 pt-2">
          <p className="text-xs text-slate-500">
            Each row needs a <code className="rounded bg-slate-800 px-1 text-sky-400">type</code> column.
            Parents must exist before children (e.g. site before building). Duplicate names are skipped.
          </p>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {CSV_FORMAT_ROWS.map(([t, fields]) => (
              <p key={t} className="text-xs text-slate-500">
                <span className="font-medium text-sky-500/90">{t}</span>
                <span className="text-slate-600"> — </span>
                {fields}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function BulkImportButton() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [globalError, setGlobalError] = useState('');

  function closeModal() {
    setOpen(false);
    reset();
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'master_data_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function uploadFile(file: File) {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setGlobalError('Please upload a .csv file');
      return;
    }
    setPending(true);
    setResult(null);
    setGlobalError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/master-data/bulk-import', { method: 'POST', body: fd });
      const data = (await res.json()) as ImportResponse;
      setResult(data);
      if (data.ok && data.totalCreated > 0) {
        ALL_QUERY_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: key }));
      }
    } catch (e) {
      setGlobalError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  function reset() {
    setResult(null);
    setGlobalError('');
  }

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-slate-600 text-slate-300 hover:text-white"
      >
        <Upload className="mr-1.5 h-3.5 w-3.5" />
        Bulk Import CSV
      </Button>
    );
  }

  const showUploadFlow = !result && !pending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        className="flex max-h-[min(90vh,680px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
        role="dialog"
        aria-labelledby="bulk-import-title"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div className="min-w-0">
            <h2 id="bulk-import-title" className="text-lg font-semibold text-slate-100">
              Bulk Import Master Data
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {result
                ? 'Import finished — review the summary below, then close or upload another file.'
                : 'One CSV can onboard sites, buildings, floors, zones, rooms, classes, sections, subjects, teachers, and staff.'}
            </p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className={`flex-1 space-y-4 px-5 py-4 ${scrollStyles}`}>
          {showUploadFlow && (
            <>
              <div className="flex flex-col gap-3 rounded-lg border border-slate-700/80 bg-slate-800/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-200">Download template CSV</p>
                    <p className="mt-0.5 text-xs text-slate-500">Example rows for every entity type.</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadTemplate}
                  className="shrink-0 border-slate-600 text-sky-400 hover:bg-slate-800 hover:text-sky-300"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Template
                </Button>
              </div>

              <ImportGuide defaultOpen={false} />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                  dragging
                    ? 'border-sky-500 bg-sky-500/10'
                    : 'border-slate-600 bg-slate-800/20 hover:border-slate-500 hover:bg-slate-800/40'
                }`}
              >
                <Upload className="mx-auto mb-3 h-8 w-8 text-slate-500" />
                <p className="text-sm font-medium text-slate-200">
                  {dragging ? 'Drop to upload' : 'Drop CSV here or click to browse'}
                </p>
                <p className="mt-1 text-xs text-slate-500">.csv files only</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </>
          )}

          {pending && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-800/30 py-14">
              <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
              <p className="text-sm text-slate-400">Processing your CSV…</p>
            </div>
          )}

          {globalError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <p className="text-sm text-red-400">{globalError}</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div
                className={`flex items-start gap-3 rounded-xl px-4 py-4 ${
                  result.totalErrors === 0
                    ? 'border border-emerald-800/50 bg-emerald-950/30'
                    : 'border border-amber-800/50 bg-amber-950/30'
                }`}
              >
                {result.totalErrors === 0 ? (
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-6 w-6 shrink-0 text-amber-400" />
                )}
                <div>
                  <p
                    className={`text-base font-semibold ${
                      result.totalErrors === 0 ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {result.totalCreated} record{result.totalCreated !== 1 ? 's' : ''} created
                    {result.totalSkipped > 0 && ` · ${result.totalSkipped} skipped`}
                    {result.totalErrors > 0 && ` · ${result.totalErrors} error${result.totalErrors !== 1 ? 's' : ''}`}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {result.totalErrors === 0
                      ? 'All Master Data tabs have been refreshed.'
                      : 'Expand a row below to see error details.'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">By category</p>
                <div className={`max-h-[min(40vh,280px)] space-y-2 pr-1 ${scrollStyles}`}>
                  {sortResults(result.results).map((r) => (
                    <ResultRow key={r.type} result={r} />
                  ))}
                </div>
              </div>

              <ImportGuide defaultOpen={false} />
            </div>
          )}
        </div>

        {/* Footer — always visible */}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-800 bg-slate-900/95 px-5 py-3">
          {result ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  reset();
                  fileRef.current?.click();
                }}
                className="border-slate-600 text-slate-300"
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Upload another
              </Button>
              <Button size="sm" onClick={closeModal}>
                Done
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={closeModal} className="text-slate-400">
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
