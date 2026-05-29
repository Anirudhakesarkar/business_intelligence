'use client';

import { useCallback, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { SMPageHeader } from '@/components/school-management/SMPageHeader';
import { SMFilterSelect } from '@/components/school-management/SMFilterBar';
import { schoolApiGet, schoolApiPost } from '@/lib/school-management/api';
import { Upload, FileText, AlertTriangle, CheckCircle2, X, Loader2, ChevronDown, ChevronUp, SlidersHorizontal, Tag } from 'lucide-react';

const ORG_ID = 1;
type Row = Record<string, unknown>;
type DayType = 'WorkingDay' | 'Holiday' | 'ExamDay' | 'EventDay' | 'HalfDay' | 'SpecialSchedule';

const DAY_TYPES: DayType[] = ['WorkingDay', 'Holiday', 'ExamDay', 'EventDay', 'HalfDay', 'SpecialSchedule'];
const DAY_COLORS: Record<DayType, { bg: string; text: string; border: string }> = {
  WorkingDay:      { bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/30' },
  Holiday:         { bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-red-500/30' },
  ExamDay:         { bg: 'bg-amber-500/10',  text: 'text-amber-400',  border: 'border-amber-500/30' },
  EventDay:        { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  HalfDay:         { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  SpecialSchedule: { bg: 'bg-teal-500/10',   text: 'text-teal-400',   border: 'border-teal-500/30' },
};

// ─── API ──────────────────────────────────────────────────────────────────────
function useCalendarData() {
  return useQuery({ queryKey: ['sm-calendar', ORG_ID], queryFn: () => schoolApiGet(`/api/school-calendar?organizationId=${ORG_ID}`) });
}

// ─── Shared atoms ─────────────────────────────────────────────────────────────
function FormField({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return <div className="space-y-1"><label className="block text-xs font-medium text-slate-400">{label}</label>{children}{error && <p className="text-xs text-red-400">{error}</p>}</div>;
}
function FInput({ value, onChange, type = 'text', placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <input type={type} className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />;
}
function SHdr({ title, onClose }: { title: string; onClose: () => void }) {
  return <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 flex-shrink-0"><h2 className="text-base font-semibold text-slate-100">{title}</h2><button onClick={onClose} className="text-slate-400 text-xl">&times;</button></div>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── CALENDAR UPLOAD ENGINE ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const HOLIDAY_KEYWORDS = [
  'holiday', 'day off', 'bank holiday', 'public holiday', 'national', 'independence',
  'republic', 'diwali', 'deepavali', 'holi', 'eid', 'christmas', 'new year', 'gandhi',
  'navratri', 'dussehra', 'pongal', 'onam', 'durga', 'puja', 'janmashtami', 'makara',
  'gurunanak', 'mahashivratri', 'baisakhi', 'ugadi', 'bihu', 'raksha', 'guru purnima',
  'ambedkar', 'vacation', 'break', 'recess', 'no school', 'closed',
];
const EXAM_KEYWORDS = [
  'exam', 'examination', 'test', 'assessment', 'board', 'cbse', 'icse', 'ib',
  'terminal', 'quarterly', 'half yearly', 'annual exam', 'unit test', 'pre-board',
];
const EVENT_KEYWORDS = [
  'sports', 'annual', 'function', 'fest', 'trip', 'celebration', 'cultural',
  'concert', 'fair', 'parade', 'competition', 'inter school', 'science day',
  'teachers day', 'children', 'prize', 'graduation', 'convocation', 'open house',
  'parent', 'ptm', 'orientation',
];
const HALFDAY_KEYWORDS = ['half day', 'early dismissal', 'short day', 'noon dismissal'];
const SPECIAL_KEYWORDS = ['special schedule', 'modified schedule', 'alternate schedule'];

function detectDayType(summary: string): DayType {
  const s = summary.toLowerCase();
  if (HALFDAY_KEYWORDS.some((k) => s.includes(k)))  return 'HalfDay';
  if (SPECIAL_KEYWORDS.some((k) => s.includes(k)))   return 'SpecialSchedule';
  if (EXAM_KEYWORDS.some((k) => s.includes(k)))      return 'ExamDay';
  if (EVENT_KEYWORDS.some((k) => s.includes(k)))     return 'EventDay';
  if (HOLIDAY_KEYWORDS.some((k) => s.includes(k)))   return 'Holiday';
  return 'EventDay';
}

type ParsedEvent = {
  calendarDate: string;
  label: string;
  dayType: DayType;
  confidence: 'high' | 'medium';
};

// ── ICS parser ────────────────────────────────────────────────────────────────
function parseIcsDate(raw: string): string | null {
  const clean = raw.split('T')[0].replace(/\D/g, '');
  if (clean.length !== 8) return null;
  return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
}

function parseIcs(text: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const blocks = text.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const dtStart = block.match(/DTSTART(?:;[^:]*)?:([^\r\n]+)/);
    const summary = block.match(/SUMMARY:([^\r\n]+)/);
    if (!dtStart) continue;
    const date = parseIcsDate(dtStart[1].trim());
    if (!date) continue;
    const rawLabel = summary
      ? summary[1].trim().replace(/\\,/g, ',').replace(/\\n/g, ' ').replace(/\\;/g, ';')
      : 'Event';
    const dayType = detectDayType(rawLabel);
    const lc = rawLabel.toLowerCase();
    const isHigh = [...HOLIDAY_KEYWORDS, ...EXAM_KEYWORDS].some((k) => lc.includes(k));
    events.push({ calendarDate: date, label: rawLabel, dayType, confidence: isHigh ? 'high' : 'medium' });
  }
  return events;
}

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCsv(text: string): ParsedEvent[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const events: ParsedEvent[] = [];
  for (const line of lines) {
    const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
    if (parts.length < 2) continue;
    const [rawDate, rawLabel, rawType] = parts;
    // Normalise date: DD/MM/YYYY → YYYY-MM-DD
    let date = rawDate;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
      const [d, m, y] = rawDate.split('/');
      date = `${y}-${m}-${d}`;
    } else if (/^\d{2}-\d{2}-\d{4}$/.test(rawDate)) {
      const [d, m, y] = rawDate.split('-');
      date = `${y}-${m}-${d}`;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !rawLabel) continue;
    const explicitType = DAY_TYPES.find((dt) => dt.toLowerCase() === rawType?.toLowerCase());
    const dayType = explicitType ?? detectDayType(rawLabel);
    events.push({ calendarDate: date, label: rawLabel, dayType, confidence: explicitType ? 'high' : 'medium' });
  }
  return events;
}

// ─── Upload Sheet ──────────────────────────────────────────────────────────────
function UploadCalendarSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [editedEvents, setEditedEvents] = useState<ParsedEvent[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number } | null>(null);

  const reset = () => {
    setFileName(''); setParseError(''); setEditedEvents([]);
    setShowAll(false); setImportResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };
  const handleClose = () => { reset(); onClose(); };

  const processFile = useCallback((file: File) => {
    setParseError(''); setEditedEvents([]); setImportResult(null);
    setFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['ics', 'csv', 'txt'].includes(ext ?? '')) {
      setParseError('Unsupported file type. Please upload an .ics or .csv file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        let events: ParsedEvent[] = [];
        if (ext === 'ics') {
          events = parseIcs(text);
        } else {
          // Skip header row if it looks like headers
          const lines = text.split(/\r?\n/).filter((l) => l.trim());
          const first = lines[0]?.toLowerCase() ?? '';
          const dataText = (first.includes('date') || first.includes('name') || first.includes('type'))
            ? lines.slice(1).join('\n') : text;
          events = parseCsv(dataText);
        }
        if (events.length === 0) {
          setParseError('No valid events found. Make sure dates are in YYYY-MM-DD or DD/MM/YYYY format.');
          return;
        }
        // Deduplicate by date (last one wins), then sort
        const deduped = Object.values(
          events.reduce<Record<string, ParsedEvent>>((acc, ev) => { acc[ev.calendarDate] = ev; return acc; }, {})
        ).sort((a, b) => a.calendarDate.localeCompare(b.calendarDate));
        setEditedEvents(deduped);
      } catch {
        setParseError('Failed to parse file. Please check the format and try again.');
      }
    };
    reader.readAsText(file);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const updateEvent = (idx: number, field: keyof ParsedEvent, value: string) => {
    setEditedEvents((prev) => prev.map((ev, i) => i === idx ? { ...ev, [field]: value } : ev));
  };
  const removeEvent = (idx: number) => {
    setEditedEvents((prev) => prev.filter((_, i) => i !== idx));
  };

  const importAll = async () => {
    if (!editedEvents.length) return;
    setImporting(true);
    try {
      const days = editedEvents.map((ev) => ({
        organizationId: ORG_ID,
        calendarDate: ev.calendarDate,
        dayType: ev.dayType,
        label: ev.label || undefined,
      }));
      const res = await fetch('/api/school-calendar/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ days }),
      });
      const data = await res.json() as { count?: number };
      setImportResult({ count: data.count ?? editedEvents.length });
      void qc.invalidateQueries({ queryKey: ['sm-calendar'] });
      void qc.invalidateQueries({ queryKey: ['sm-setup-health'] });
    } finally {
      setImporting(false);
    }
  };

  const typeBreakdown = DAY_TYPES.reduce<Partial<Record<DayType, number>>>((acc, dt) => {
    const c = editedEvents.filter((ev) => ev.dayType === dt).length;
    if (c > 0) acc[dt] = c;
    return acc;
  }, {});

  const displayEvents = showAll ? editedEvents : editedEvents.slice(0, 15);
  const hasMore = editedEvents.length > 15;

  return (
    <Sheet open={open} onClose={handleClose}>
      <SHdr title="Upload Calendar" onClose={handleClose} />
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

        {/* ── Success ── */}
        {importResult && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-green-700/50 bg-green-950/20 p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-400" />
            <div>
              <p className="text-base font-semibold text-green-300">Import complete!</p>
              <p className="mt-1 text-sm text-slate-400">{importResult.count} calendar entries saved.</p>
              <p className="mt-0.5 text-xs text-slate-600">Existing dates were updated; new dates were added.</p>
            </div>
            <Button size="sm" onClick={handleClose}>Close</Button>
          </div>
        )}

        {!importResult && (
          <>
            {/* ── Drop zone ── */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                dragging
                  ? 'border-sky-500 bg-sky-950/20'
                  : 'border-slate-700 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700/60">
                <Upload className="h-6 w-6 text-slate-300" />
              </div>
              {fileName ? (
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-200">
                    <FileText className="h-4 w-4 text-sky-400" /> {fileName}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">Click to replace</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-slate-200">Drop your calendar file here</p>
                  <p className="mt-0.5 text-xs text-slate-500">or click to browse</p>
                </div>
              )}
              <p className="text-xs text-slate-600">
                .ics (Google Calendar, Outlook, Apple Calendar) &nbsp;·&nbsp; .csv (date, name, type)
              </p>
              <input ref={fileRef} type="file" accept=".ics,.csv,.txt" className="hidden" onChange={onFileChange} />
            </div>

            {/* ── Format hint ── */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-500 space-y-1.5">
              <p className="font-medium text-slate-400">How it works</p>
              <p><span className="text-sky-400 font-mono">.ics</span> — Export from Google Cal / Outlook / Apple Calendar. Events are auto-classified by name (Diwali → Holiday, Annual Exam → ExamDay, Sports Day → EventDay, etc.).</p>
              <p><span className="text-sky-400 font-mono">.csv</span> — Three columns: <span className="font-mono text-slate-400">date, event_name, type</span> (type optional). Accepts YYYY-MM-DD or DD/MM/YYYY.</p>
              <p className="text-slate-600">You can review and edit every entry before importing.</p>
            </div>

            {/* ── Error ── */}
            {parseError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-700/40 bg-red-950/20 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p className="text-sm text-red-300">{parseError}</p>
              </div>
            )}

            {/* ── Parsed preview ── */}
            {editedEvents.length > 0 && (
              <div className="space-y-3">
                {/* Type breakdown badges */}
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-400">
                    {editedEvents.length} events detected — classified automatically
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.entries(typeBreakdown) as [DayType, number][]).map(([dt, count]) => (
                      <span key={dt} className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${DAY_COLORS[dt].bg} ${DAY_COLORS[dt].text} ${DAY_COLORS[dt].border}`}>
                        {dt} <span className="opacity-60">×{count}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Editable rows */}
                <div className="space-y-1.5">
                  {displayEvents.map((ev, idx) => {
                    const col = DAY_COLORS[ev.dayType];
                    return (
                      <div key={`${ev.calendarDate}-${idx}`} className={`flex items-center gap-2 rounded-lg border p-2 ${col.border} ${col.bg}`}>
                        <span className="w-24 shrink-0 font-mono text-xs text-slate-400">{ev.calendarDate}</span>
                        <input
                          className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          value={ev.label}
                          onChange={(e) => updateEvent(idx, 'label', e.target.value)}
                          placeholder="Event name"
                        />
                        <select
                          value={ev.dayType}
                          onChange={(e) => updateEvent(idx, 'dayType', e.target.value)}
                          className={`shrink-0 rounded border bg-slate-900 px-1.5 py-0.5 text-xs focus:outline-none ${col.border} ${col.text}`}
                        >
                          {DAY_TYPES.map((dt) => <option key={dt} value={dt}>{dt}</option>)}
                        </select>
                        <span
                          className={`shrink-0 text-[10px] font-bold ${ev.confidence === 'high' ? 'text-green-500' : 'text-amber-500'}`}
                          title={`Detection confidence: ${ev.confidence}`}
                        >
                          {ev.confidence === 'high' ? '●' : '◐'}
                        </span>
                        <button onClick={() => removeEvent(idx)} className="shrink-0 text-slate-600 hover:text-red-400 transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {hasMore && (
                  <button
                    onClick={() => setShowAll((v) => !v)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showAll
                      ? <><ChevronUp className="h-3.5 w-3.5" /> Show fewer</>
                      : <><ChevronDown className="h-3.5 w-3.5" /> Show all {editedEvents.length} events</>}
                  </button>
                )}

                <p className="text-xs text-slate-600">
                  ● high confidence &nbsp; ◐ medium — verify before importing &nbsp;· Existing dates will be overwritten.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {!importResult && editedEvents.length > 0 && (
        <div className="flex flex-shrink-0 items-center justify-between border-t border-slate-800 px-6 py-4">
          <p className="text-xs text-slate-500">{editedEvents.length} events will be imported</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button
              onClick={() => void importAll()}
              disabled={importing}
              className="bg-sky-700 hover:bg-sky-600"
            >
              {importing
                ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Importing…</>
                : `Import ${editedEvents.length} events`}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div className="flex flex-wrap gap-2">
      {DAY_TYPES.map((t) => (
        <span key={t} className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium border ${DAY_COLORS[t].bg} ${DAY_COLORS[t].text} ${DAY_COLORS[t].border}`}>{t}</span>
      ))}
    </div>
  );
}

// ─── Month Calendar ───────────────────────────────────────────────────────────
function MonthCalendar({ year, month, calMap, onDayClick }: {
  year: number; month: number; calMap: Record<string, Row>;
  onDayClick: (date: string, existing: Row | null) => void;
}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow    = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const pad = (n: number) => String(n).padStart(2, '0');
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <div>
      <div className="grid grid-cols-7 mb-1 text-center text-xs text-slate-500">
        {DOW.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
          const entry   = calMap[dateStr];
          const dt      = entry ? (entry.dayType as DayType) : null;
          const isToday = dateStr === new Date().toISOString().slice(0, 10);
          const colors  = dt ? DAY_COLORS[dt] : null;
          return (
            <div
              key={i}
              onClick={() => onDayClick(dateStr, entry ?? null)}
              className={`relative min-h-[52px] cursor-pointer rounded p-1.5 text-center transition-all hover:ring-1 hover:ring-blue-400 ${
                colors ? `${colors.bg} ${colors.border} border` : 'border border-slate-800 hover:border-slate-600'
              } ${isToday ? 'ring-1 ring-blue-500' : ''}`}
            >
              <span className={`text-xs font-medium ${isToday ? 'text-blue-400' : colors ? colors.text : 'text-slate-400'}`}>{day}</span>
              {dt && dt !== 'WorkingDay' && (
                <div className={`mt-0.5 truncate text-xs ${colors!.text}`} style={{ fontSize: '9px' }}>
                  {dt.replace('Day', '').replace('Schedule', 'Sched.')}
                </div>
              )}
              {entry?.label != null && (
                <div className="truncate text-slate-500" style={{ fontSize: '8px' }}>{String(entry.label)}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Heat view ────────────────────────────────────────────────────────────────
function HeatView({ calendar }: { calendar: Row[] }) {
  const counts: Record<DayType, number> = { WorkingDay: 0, Holiday: 0, ExamDay: 0, EventDay: 0, HalfDay: 0, SpecialSchedule: 0 };
  calendar.forEach((c) => { const dt = c.dayType as DayType; if (counts[dt] !== undefined) counts[dt]++; });
  const total = calendar.length;
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">{total} days configured</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {DAY_TYPES.map((dt) => {
          const pct = total ? Math.round((counts[dt] / total) * 100) : 0;
          const col = DAY_COLORS[dt];
          return (
            <div key={dt} className={`rounded-lg border p-4 ${col.border} ${col.bg}`}>
              <div className="mb-2 flex items-center justify-between">
                <span className={`text-sm font-semibold ${col.text}`}>{dt}</span>
                <span className={`text-lg font-bold ${col.text}`}>{counts[dt]}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${col.text.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{pct}% of configured days</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day edit sheet ───────────────────────────────────────────────────────────
function DaySheet({ open, onClose, date, existing }: { open: boolean; onClose: () => void; date: string; existing: Row | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ dayType: 'WorkingDay', label: '' });
  useState(() => { setForm({ dayType: String(existing?.dayType ?? 'WorkingDay'), label: String(existing?.label ?? '') }); });
  const create = useMutation({
    mutationFn: (b: unknown) => schoolApiPost('/api/school-calendar', b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sm-calendar'] }); qc.invalidateQueries({ queryKey: ['sm-setup-health'] }); onClose(); },
  });
  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Sheet open={open} onClose={onClose}>
      <SHdr title={existing ? `Edit ${date}` : `Mark ${date}`} onClose={onClose} />
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <FormField label="Day type">
          <select className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 focus:outline-none" value={form.dayType} onChange={(e) => set('dayType')(e.target.value)}>
            {DAY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormField>
        <FormField label="Label / notes (optional)">
          <FInput value={form.label} onChange={set('label')} placeholder="Republic Day, Term 1 exams…" />
        </FormField>
      </div>
      <div className="flex flex-shrink-0 justify-end gap-2 border-t border-slate-800 px-6 py-4">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => create.mutate({ organizationId: ORG_ID, calendarDate: date, dayType: form.dayType, label: form.label || undefined })} disabled={create.isPending}>
          {create.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Sheet>
  );
}

// ─── Bulk Holiday Sheet ───────────────────────────────────────────────────────
function BulkHolidaySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dayType, setDayType] = useState<DayType>('Holiday');
  const [label, setLabel] = useState('');
  const [excludeWeekends, setExcludeWeekends] = useState(true);
  const [err, setErr] = useState('');

  const buildDates = () => {
    if (!dateFrom || !dateTo) return [];
    const dates: string[] = [];
    const cur = new Date(dateFrom);
    const end = new Date(dateTo);
    while (cur <= end) {
      const dow = cur.getDay();
      if (!excludeWeekends || (dow !== 0 && dow !== 6)) dates.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  };

  const bulk = useMutation({
    mutationFn: (days: unknown[]) => schoolApiPost('/api/school-calendar/bulk', { days }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sm-calendar'] }); qc.invalidateQueries({ queryKey: ['sm-setup-health'] }); onClose(); setErr(''); },
    onError: (e: Error) => setErr(e.message),
  });

  const save = () => {
    const dates = buildDates();
    if (!dates.length) return setErr('No dates in range (or all weekends excluded)');
    bulk.mutate(dates.map((d) => ({ organizationId: ORG_ID, calendarDate: d, dayType, label: label || undefined })));
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <SHdr title="Bulk Mark Days" onClose={onClose} />
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {err && <p className="text-xs text-red-400">{err}</p>}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="From date *"><FInput type="date" value={dateFrom} onChange={setDateFrom} /></FormField>
          <FormField label="To date *"><FInput type="date" value={dateTo} onChange={setDateTo} /></FormField>
        </div>
        <FormField label="Day type">
          <select className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 focus:outline-none" value={dayType} onChange={(e) => setDayType(e.target.value as DayType)}>
            {DAY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormField>
        <FormField label="Label (applied to all)"><FInput value={label} onChange={setLabel} placeholder="Summer holidays…" /></FormField>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={excludeWeekends} onChange={(e) => setExcludeWeekends(e.target.checked)} className="accent-blue-500" />
          Exclude weekends (Sat/Sun)
        </label>
        {dateFrom && dateTo && (
          <div className="rounded bg-slate-800 p-3 text-xs text-slate-400">
            {buildDates().length} day(s) will be marked as <span className="font-semibold text-slate-200">{dayType}</span>
          </div>
        )}
      </div>
      <div className="flex flex-shrink-0 justify-end gap-2 border-t border-slate-800 px-6 py-4">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={bulk.isPending}>{bulk.isPending ? 'Saving…' : `Mark ${buildDates().length} days`}</Button>
      </div>
    </Sheet>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
type ViewMode = 'month' | 'heat' | 'list';

export default function CalendarPage() {
  const { data = [], isLoading } = useCalendarData();
  const [view, setView]           = useState<ViewMode>('month');
  const [currentYear, setCurrentYear]   = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [dayTypeFilter, setDayTypeFilter] = useState<DayType | ''>('');
  const [dayOpen, setDayOpen]     = useState(false);
  const [bulkOpen, setBulkOpen]   = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedDate, setSelectedDate]         = useState('');
  const [selectedExisting, setSelectedExisting] = useState<Row | null>(null);

  const calendar: Row[] = Array.isArray(data) ? data : [];
  const calMap = Object.fromEntries(calendar.map((c) => [String(c.calendarDate), c]));

  const handleDayClick = (date: string, existing: Row | null) => {
    setSelectedDate(date); setSelectedExisting(existing); setDayOpen(true);
  };

  const monthName = new Date(currentYear, currentMonth, 1).toLocaleString('default', { month: 'long' });
  const viewOpts: { id: ViewMode; label: string }[] = [
    { id: 'month', label: 'Month View' },
    { id: 'heat',  label: 'Heat Summary' },
    { id: 'list',  label: 'List View' },
  ];

  return (
    <div className="space-y-6">
      <SMPageHeader
        title="School Calendar"
        subtitle="Working days, holidays, exams, and special schedules. Upload a .ics or .csv file to import in bulk."
        action={
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setUploadOpen(true)} className="bg-sky-700 hover:bg-sky-600">
              <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload Calendar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>Bulk Mark</Button>
          </div>
        }
      />

      <Legend />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/60 px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-1.5 pl-1 pr-2 text-xs uppercase tracking-wider text-slate-500">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
        </div>
        <SMFilterSelect
          icon={<Tag className="h-4 w-4" />}
          label="Day type"
          value={dayTypeFilter}
          onChange={(v) => setDayTypeFilter(v as DayType | '')}
          options={[{ label: 'All day types', value: '' }, ...DAY_TYPES.map((dt) => ({ label: dt, value: dt }))]}
        />
        {dayTypeFilter && (
          <button
            onClick={() => setDayTypeFilter('')}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* View switcher + nav */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 border-b border-slate-800">
          {viewOpts.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                view === v.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        {view === 'month' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); } else setCurrentMonth((m) => m - 1); }}
              className="rounded border border-slate-700 px-2 py-1 text-sm text-slate-400 hover:border-slate-500"
            >‹</button>
            <span className="w-36 text-center text-sm font-medium text-slate-200">{monthName} {currentYear}</span>
            <button
              onClick={() => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); } else setCurrentMonth((m) => m + 1); }}
              className="rounded border border-slate-700 px-2 py-1 text-sm text-slate-400 hover:border-slate-500"
            >›</button>
          </div>
        )}
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading calendar…</p>}

      {!isLoading && view === 'month' && (
        <MonthCalendar year={currentYear} month={currentMonth} calMap={calMap} onDayClick={handleDayClick} />
      )}
      {!isLoading && view === 'heat' && <HeatView calendar={dayTypeFilter ? calendar.filter((c) => c.dayType === dayTypeFilter) : calendar} />}
      {!isLoading && view === 'list' && (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Day type</th>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...calendar]
                .filter((c) => !dayTypeFilter || c.dayType === dayTypeFilter)
                .sort((a, b) => String(a.calendarDate).localeCompare(String(b.calendarDate)))
                .map((c) => {
                  const dt  = c.dayType as DayType;
                  const col = DAY_COLORS[dt] ?? DAY_COLORS.WorkingDay;
                  return (
                    <tr key={String(c.id ?? c.calendarDate)} className="border-t border-slate-800 text-slate-300 hover:bg-slate-800/40">
                      <td className="px-3 py-2 font-mono text-xs">{String(c.calendarDate)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${col.bg} ${col.text}`}>{dt}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-500">{String(c.label ?? '—')}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => handleDayClick(String(c.calendarDate), c)} className="text-xs text-sky-400 hover:underline">Edit</button>
                      </td>
                    </tr>
                  );
                })}
              {!calendar.length && (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-xs text-slate-500">
                    No calendar entries yet. Use <span className="font-medium text-sky-400">Upload Calendar</span> or click any day to add.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <DaySheet open={dayOpen} onClose={() => setDayOpen(false)} date={selectedDate} existing={selectedExisting} />
      <BulkHolidaySheet open={bulkOpen} onClose={() => setBulkOpen(false)} />
      <UploadCalendarSheet open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}
