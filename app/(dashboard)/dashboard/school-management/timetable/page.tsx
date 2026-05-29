'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { SMPageHeader } from '@/components/school-management/SMPageHeader';
import { schoolApiDelete, schoolApiGet, schoolApiPatch, schoolApiPost } from '@/lib/school-management/api';

const ORG_ID = 1;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIOD_TYPES = ['Period', 'Break', 'Lunch', 'Assembly', 'Lab', 'Library', 'PT'];

type Row = Record<string, unknown>;
type TimetableImportValidation = {
  valid?: boolean;
  errors: string[];
  warnings: string[];
  resolvedPreview?: Array<Record<string, unknown>>;
};

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useTimetable() { return useQuery({ queryKey: ['sm-timetable', ORG_ID], queryFn: () => schoolApiGet(`/api/timetable?organizationId=${ORG_ID}`) }); }
function useClasses() { return useQuery({ queryKey: ['sm-classes', ORG_ID], queryFn: () => schoolApiGet(`/api/classes?organizationId=${ORG_ID}`) }); }
function useSections(classId?: number) { return useQuery({ queryKey: ['sm-sections', classId], queryFn: () => schoolApiGet(`/api/sections?classId=${classId}`), enabled: !!classId }); }
function useSubjects() { return useQuery({ queryKey: ['sm-subjects', ORG_ID], queryFn: () => schoolApiGet(`/api/subjects?organizationId=${ORG_ID}`) }); }
function useTeachers() { return useQuery({ queryKey: ['sm-teachers', ORG_ID], queryFn: () => schoolApiGet(`/api/teachers?organizationId=${ORG_ID}`) }); }
function useRooms() { return useQuery({ queryKey: ['sm-rooms', ORG_ID], queryFn: () => schoolApiGet(`/api/rooms?organizationId=${ORG_ID}`) }); }

// ─── Shared atoms ─────────────────────────────────────────────────────────────
function FormField({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-slate-400">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
function FSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { label: string; value: string | number }[] }) {
  return <select className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500" value={value} onChange={(e) => onChange(e.target.value)}><option value="">— select —</option>{options.map((o) => <option key={o.value} value={String(o.value)}>{o.label}</option>)}</select>;
}
function FInput({ value, onChange, type = 'text', placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <input type={type} className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />;
}
function SHdr({ title, onClose }: { title: string; onClose: () => void }) {
  return <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 flex-shrink-0"><h2 className="text-base font-semibold text-slate-100">{title}</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-xl">&times;</button></div>;
}
function Pill({ label, color }: { label: string; color?: 'blue' | 'amber' | 'green' | 'slate' }) {
  const cls = { blue: 'bg-blue-500/10 text-blue-400', amber: 'bg-amber-500/10 text-amber-400', green: 'bg-green-500/10 text-green-400', slate: 'bg-slate-700 text-slate-300' }[color ?? 'slate'];
  return <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

// ─── Weekly Grid ──────────────────────────────────────────────────────────────
function sectionLabel(sec: Row | undefined, classMap: Record<string, Row>): string {
  if (!sec) return '';
  const cls = classMap[String(sec.classId)];
  return cls ? `${String(cls.name)} — ${String(sec.name)}` : String(sec.name);
}

function WeeklyGrid({ entries, sections, classes, subjects, teachers, rooms, onDelete, onEdit }: {
  entries: Row[]; sections: Row[]; classes: Row[]; subjects: Row[]; teachers: Row[]; rooms: Row[];
  onDelete: (id: number) => void;
  onEdit: (row: Row) => void;
}) {
  const secMap = Object.fromEntries(sections.map((s) => [String(s.id), s]));
  const classMap = Object.fromEntries(classes.map((c) => [String(c.id), c]));
  const subMap = Object.fromEntries(subjects.map((s) => [String(s.id), s]));
  const tchMap = Object.fromEntries(teachers.map((t) => [String(t.id), t]));
  const roomMap = Object.fromEntries(rooms.map((r) => [String(r.id), r]));

  // Group entries by day
  const byDay: Record<number, Row[]> = {};
  entries.forEach((e) => {
    const d = Number(e.dayOfWeek);
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(e);
  });
  // Sort each day by startTime
  Object.values(byDay).forEach((arr) => arr.sort((a, b) => String(a.startTime).localeCompare(String(b.startTime))));

  if (!entries.length) return <p className="py-10 text-center text-sm text-slate-500">No timetable entries. Use Import CSV or + Add Entry to get started.</p>;

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[800px]" style={{ gridTemplateColumns: `80px repeat(${DAYS.length}, 1fr)` }}>
        {/* Header */}
        <div className="px-2 py-2 text-xs text-slate-500" />
        {DAYS.map((d, i) => (
          <div key={d} className="px-2 py-2 text-xs font-semibold text-slate-400 text-center border-l border-slate-800">{d}</div>
        ))}
        {/* Body: collect all unique time slots */}
        {(() => {
          const allTimes = [...new Set(entries.map((e) => `${e.startTime}–${e.endTime}`))].sort();
          return allTimes.map((slot, si) => {
            const [start, end] = slot.split('–');
            return [
              <div key={`t-${si}`} className="border-t border-slate-800 px-2 py-3 text-xs text-slate-600 leading-tight">
                <div>{start}</div><div>{end}</div>
              </div>,
              ...DAYS.map((_, di) => {
                const dayEntries = (byDay[di + 1] ?? []).filter((e) => e.startTime === start && e.endTime === end);
                return (
                  <div key={`c-${si}-${di}`} className="border-t border-l border-slate-800 px-2 py-1.5 space-y-1 min-h-[60px]">
                    {dayEntries.map((e) => {
                      const sec = secMap[String(e.sectionId)];
                      const sub = e.subjectId ? subMap[String(e.subjectId)] : null;
                      const tch = e.teacherId ? tchMap[String(e.teacherId)] : null;
                      const room = roomMap[String(e.roomId)];
                      const isOverlap = dayEntries.length > 1;
                      return (
                        <div key={String(e.id)} className={`rounded p-1.5 text-xs space-y-0.5 group relative ${isOverlap ? 'border border-red-500/50 bg-red-500/5' : 'bg-blue-500/10'}`}>
                          <div className="font-medium text-slate-200 truncate">{sec ? sectionLabel(sec, classMap) : `S:${e.sectionId}`}</div>
                          {sub && <div className="text-slate-400 truncate">{String(sub.name)}</div>}
                          {tch && <div className="text-slate-500 truncate">{String(tch.name)}</div>}
                          {room && <div className="text-slate-600 truncate font-mono">{String(room.roomCode)}</div>}
                          <div className="absolute top-0.5 right-0.5 flex gap-1 opacity-0 group-hover:opacity-100">
                            <button type="button" onClick={() => onEdit(e)} className="text-sky-400 hover:text-sky-300 text-[10px] leading-none px-0.5" title="Edit">✎</button>
                            <button type="button" onClick={() => onDelete(e.id as number)} className="text-red-400 hover:text-red-300 text-xs leading-none px-0.5" title="Remove">&times;</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }),
            ];
          });
        })()}
      </div>
    </div>
  );
}

// ─── Teacher View ─────────────────────────────────────────────────────────────
function TeacherView({ entries, teachers, sections, subjects, rooms, onEdit }: { entries: Row[]; teachers: Row[]; sections: Row[]; subjects: Row[]; rooms: Row[]; onEdit: (row: Row) => void }) {
  const [teacherId, setTeacherId] = useState('');
  const secMap = Object.fromEntries(sections.map((s) => [String(s.id), s]));
  const subMap = Object.fromEntries(subjects.map((s) => [String(s.id), s]));
  const roomMap = Object.fromEntries(rooms.map((r) => [String(r.id), r]));
  const teacherOpts = teachers.map((t) => ({ label: String(t.name), value: String(t.id) }));
  const filtered = entries.filter((e) => !teacherId || String(e.teacherId) === teacherId);
  return (
    <div className="space-y-4">
      <select className="h-9 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-300 focus:outline-none w-64" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
        <option value="">All teachers</option>
        {teacherOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {!filtered.length ? <p className="text-sm text-slate-500 py-8 text-center">No entries for selected teacher.</p> : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-xs text-slate-500"><tr><th className="px-3 py-2 text-left">Day</th><th className="px-3 py-2 text-left">Time</th><th className="px-3 py-2 text-left">Section</th><th className="px-3 py-2 text-left">Subject</th><th className="px-3 py-2 text-left">Room</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Actions</th></tr></thead>
            <tbody>
              {filtered.sort((a, b) => Number(a.dayOfWeek) - Number(b.dayOfWeek)).map((e) => (
                <tr key={String(e.id ?? `${e.sectionId}-${e.dayOfWeek}-${e.startTime}-${e.roomId}`)} className="border-t border-slate-800 text-slate-300 hover:bg-slate-800/40">
                  <td className="px-3 py-2">{DAYS[Number(e.dayOfWeek) - 1] ?? String(e.dayOfWeek)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{String(e.startTime)}–{String(e.endTime)}</td>
                  <td className="px-3 py-2">{String(secMap[String(e.sectionId)]?.name ?? e.sectionId)}</td>
                  <td className="px-3 py-2">{e.subjectId ? String(subMap[String(e.subjectId)]?.name ?? e.subjectId) : '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{String(roomMap[String(e.roomId)]?.roomCode ?? e.roomId)}</td>
                  <td className="px-3 py-2"><Pill label={String(e.periodType)} color="slate" /></td>
                  <td className="px-3 py-2"><button type="button" onClick={() => onEdit(e)} className="text-xs text-sky-400 hover:underline">Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Room View ────────────────────────────────────────────────────────────────
function RoomView({ entries, rooms, sections, subjects, teachers, onEdit }: { entries: Row[]; rooms: Row[]; sections: Row[]; subjects: Row[]; teachers: Row[]; onEdit: (row: Row) => void }) {
  const [roomId, setRoomId] = useState('');
  const secMap = Object.fromEntries(sections.map((s) => [String(s.id), s]));
  const subMap = Object.fromEntries(subjects.map((s) => [String(s.id), s]));
  const tchMap = Object.fromEntries(teachers.map((t) => [String(t.id), t]));
  const roomOpts = rooms.map((r) => ({ label: `${r.roomCode} — ${r.roomName}`, value: String(r.id) }));
  const filtered = entries.filter((e) => !roomId || String(e.roomId) === roomId);
  // Detect double-bookings
  const bookingKey = (e: Row) => `${e.dayOfWeek}-${e.startTime}-${e.endTime}`;
  const keyCounts: Record<string, number> = {};
  filtered.forEach((e) => { const k = bookingKey(e); keyCounts[k] = (keyCounts[k] ?? 0) + 1; });
  return (
    <div className="space-y-4">
      <select className="h-9 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-300 focus:outline-none w-72" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
        <option value="">All rooms</option>
        {roomOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {!filtered.length ? <p className="text-sm text-slate-500 py-8 text-center">No entries for selected room.</p> : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-xs text-slate-500"><tr><th className="px-3 py-2 text-left">Day</th><th className="px-3 py-2 text-left">Time</th><th className="px-3 py-2 text-left">Section</th><th className="px-3 py-2 text-left">Subject</th><th className="px-3 py-2 text-left">Teacher</th><th className="px-3 py-2 text-left">Conflict</th><th className="px-3 py-2 text-left">Actions</th></tr></thead>
            <tbody>
              {filtered.sort((a, b) => Number(a.dayOfWeek) - Number(b.dayOfWeek) || String(a.startTime).localeCompare(String(b.startTime))).map((e) => {
                const conflict = keyCounts[bookingKey(e)] > 1;
                return (
                  <tr key={String(e.id ?? `${e.roomId}-${e.dayOfWeek}-${e.startTime}`)} className={`border-t border-slate-800 text-slate-300 hover:bg-slate-800/40 ${conflict ? 'bg-red-500/5' : ''}`}>
                    <td className="px-3 py-2">{DAYS[Number(e.dayOfWeek) - 1]}</td>
                    <td className="px-3 py-2 font-mono text-xs">{String(e.startTime)}–{String(e.endTime)}</td>
                    <td className="px-3 py-2">{String(secMap[String(e.sectionId)]?.name ?? e.sectionId)}</td>
                    <td className="px-3 py-2">{e.subjectId ? String(subMap[String(e.subjectId)]?.name ?? e.subjectId) : '—'}</td>
                    <td className="px-3 py-2">{e.teacherId ? String(tchMap[String(e.teacherId)]?.name ?? e.teacherId) : '—'}</td>
                    <td className="px-3 py-2">{conflict ? <Pill label="Double-booked" color="amber" /> : '—'}</td>
                    <td className="px-3 py-2"><button type="button" onClick={() => onEdit(e)} className="text-xs text-sky-400 hover:underline">Edit</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Section View ─────────────────────────────────────────────────────────────
function SectionView({
  entries,
  sections,
  classes,
  subjects,
  teachers,
  rooms,
  filterClassId,
  onEdit,
}: {
  entries: Row[];
  sections: Row[];
  classes: Row[];
  subjects: Row[];
  teachers: Row[];
  rooms: Row[];
  filterClassId: string;
  onEdit: (row: Row) => void;
}) {
  const [sectionId, setSectionId] = useState('');
  const secMap = Object.fromEntries(sections.map((s) => [String(s.id), s]));
  const classMap = Object.fromEntries(classes.map((c) => [String(c.id), c]));
  const subMap = Object.fromEntries(subjects.map((s) => [String(s.id), s]));
  const tchMap = Object.fromEntries(teachers.map((t) => [String(t.id), t]));
  const roomMap = Object.fromEntries(rooms.map((r) => [String(r.id), r]));
  const visibleSections = sections.filter((s) => !filterClassId || String(s.classId) === filterClassId);
  const secOpts = visibleSections.map((s) => ({
    label: sectionLabel(s, classMap),
    value: String(s.id),
  }));
  const filtered = entries.filter((e) => !sectionId || String(e.sectionId) === sectionId);
  return (
    <div className="space-y-4">
      <select className="h-9 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-300 focus:outline-none w-48" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
        <option value="">All sections</option>
        {secOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {!filtered.length ? <p className="text-sm text-slate-500 py-8 text-center">No entries for selected section.</p> : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-xs text-slate-500"><tr><th className="px-3 py-2 text-left">Day</th><th className="px-3 py-2 text-left">Time</th><th className="px-3 py-2 text-left">Subject</th><th className="px-3 py-2 text-left">Teacher</th><th className="px-3 py-2 text-left">Room</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Actions</th></tr></thead>
            <tbody>
              {filtered.sort((a, b) => Number(a.dayOfWeek) - Number(b.dayOfWeek) || String(a.startTime).localeCompare(String(b.startTime))).map((e) => (
                <tr key={String(e.id ?? `${e.sectionId}-${e.dayOfWeek}-${e.startTime}-${e.roomId}`)} className="border-t border-slate-800 text-slate-300 hover:bg-slate-800/40">
                  <td className="px-3 py-2">{DAYS[Number(e.dayOfWeek) - 1]}</td>
                  <td className="px-3 py-2 font-mono text-xs">{String(e.startTime)}–{String(e.endTime)}</td>
                  <td className="px-3 py-2">{e.subjectId ? String(subMap[String(e.subjectId)]?.name ?? e.subjectId) : '—'}</td>
                  <td className="px-3 py-2">{e.teacherId ? String(tchMap[String(e.teacherId)]?.name ?? e.teacherId) : '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{String(roomMap[String(e.roomId)]?.roomCode ?? e.roomId)}</td>
                  <td className="px-3 py-2"><Pill label={String(e.periodType)} color="slate" /></td>
                  <td className="px-3 py-2"><button type="button" onClick={() => onEdit(e)} className="text-xs text-sky-400 hover:underline">Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Entry form sheet (add / edit) ─────────────────────────────────────────────
function EntrySheet({ open, onClose, editing, allSections }: { open: boolean; onClose: () => void; editing: Row | null; allSections: Row[] }) {
  const qc = useQueryClient();
  const { data: classesRaw = [] } = useClasses();
  const [classId, setClassId] = useState('');
  const { data: sectionsRaw = [] } = useSections(classId ? Number(classId) : undefined);
  const { data: subjectsRaw = [] } = useSubjects();
  const { data: teachersRaw = [] } = useTeachers();
  const { data: roomsRaw = [] } = useRooms();

  const classes  = Array.isArray(classesRaw)  ? classesRaw  : [];
  const sections = Array.isArray(sectionsRaw) ? sectionsRaw : [];
  const subjects = Array.isArray(subjectsRaw) ? subjectsRaw : [];
  const teachers = Array.isArray(teachersRaw) ? teachersRaw : [];
  const rooms    = Array.isArray(roomsRaw)    ? roomsRaw    : [];

  const [form, setForm] = useState({ sectionId: '', subjectId: '', teacherId: '', roomId: '', periodType: 'Period', dayOfWeek: '1', startTime: '08:00', endTime: '08:45' });
  const [errs, setErrs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (editing) {
      // Fix: use Number() coercion so string-vs-number ids both match
      const sec = allSections.find((s) => Number(s.id) === Number(editing.sectionId));
      const cid = sec ? String(sec.classId) : '';
      setClassId(cid);
      setForm({
        sectionId: String(editing.sectionId ?? ''),
        subjectId: editing.subjectId ? String(editing.subjectId) : '',
        teacherId: editing.teacherId ? String(editing.teacherId) : '',
        roomId: String(editing.roomId ?? ''),
        periodType: String(editing.periodType ?? 'Period'),
        dayOfWeek: String(editing.dayOfWeek ?? '1'),
        startTime: String(editing.startTime ?? '08:00'),
        endTime: String(editing.endTime ?? '08:45'),
      });
    } else {
      setClassId('');
      setForm({ sectionId: '', subjectId: '', teacherId: '', roomId: '', periodType: 'Period', dayOfWeek: '1', startTime: '08:00', endTime: '08:45' });
    }
    setErrs({});
  }, [editing, open, allSections]);

  const create = useMutation({
    mutationFn: (b: unknown) => schoolApiPost('/api/timetable', b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sm-timetable'] }); qc.invalidateQueries({ queryKey: ['sm-setup-health'] }); onClose(); setErrs({}); },
    onError: (e: Error) => setErrs({ _api: e.message }),
  });
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: unknown }) => schoolApiPatch(`/api/timetable/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sm-timetable'] }); qc.invalidateQueries({ queryKey: ['sm-setup-health'] }); onClose(); setErrs({}); },
    onError: (e: Error) => setErrs({ _api: e.message }),
  });

  const classOpts = classes.map((c: Row) => ({ label: String(c.name), value: String(c.id) }));
  const secOpts   = sections.map((s: Row) => ({ label: String(s.name), value: String(s.id) }));
  const subOpts   = subjects.map((s: Row) => ({ label: String(s.name), value: String(s.id) }));
  const tchOpts   = teachers.map((t: Row) => ({ label: String(t.name), value: String(t.id) }));
  const roomOpts  = rooms.map((r: Row) => ({ label: `${r.roomCode} — ${r.roomName}`, value: String(r.id) }));
  const dayOpts   = DAYS.map((d, i) => ({ label: d, value: String(i + 1) }));
  const ptOpts    = PERIOD_TYPES.map((p) => ({ label: p, value: p }));

  const set = (k: string) => (v: string) => { setErrs({}); setForm((f) => ({ ...f, [k]: v })); };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!classId) e.classId = 'Please select a class first';
    if (!form.sectionId) e.sectionId = 'Section is required';
    if (!form.dayOfWeek) e.dayOfWeek = 'Day is required';
    if (!form.startTime || !form.endTime) e.startTime = 'Start and end times are required';
    else if (form.endTime <= form.startTime) e.endTime = 'End time must be after start time';
    if (!form.roomId) e.roomId = 'Room is required';
    return e;
  };

  const save = () => {
    const e = validate();
    if (Object.keys(e).length) return setErrs(e);
    const body = {
      sectionId: Number(form.sectionId),
      subjectId: form.subjectId ? Number(form.subjectId) : undefined,
      teacherId: form.teacherId ? Number(form.teacherId) : undefined,
      roomId: Number(form.roomId),
      periodType: form.periodType,
      dayOfWeek: Number(form.dayOfWeek),
      startTime: form.startTime,
      endTime: form.endTime,
    };
    if (editing) patch.mutate({ id: editing.id as number, body });
    else create.mutate({ organizationId: ORG_ID, ...body });
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <SHdr title={editing ? 'Edit Timetable Entry' : 'Add Timetable Entry'} onClose={onClose} />
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {errs._api && <p className="rounded bg-red-500/10 px-3 py-2 text-xs text-red-400">{errs._api}</p>}
        <div className="rounded-md border border-slate-700/50 bg-slate-800/30 px-3 py-2 text-xs text-slate-500">
          Select a <span className="text-slate-300">Class</span> to load its sections, then fill the schedule details.
        </div>
        <FormField label="Class *" error={errs.classId}>
          <FSelect value={classId} onChange={(v) => { setErrs({}); setClassId(v); setForm((f) => ({ ...f, sectionId: '' })); }} options={classOpts} />
        </FormField>
        <FormField label="Section *" error={errs.sectionId}>
          <FSelect value={form.sectionId} onChange={set('sectionId')} options={secOpts} />
          {classId && secOpts.length === 0 && <p className="text-xs text-slate-500">No sections for this class — add them in Master Data.</p>}
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Day of week *" error={errs.dayOfWeek}><FSelect value={form.dayOfWeek} onChange={set('dayOfWeek')} options={dayOpts} /></FormField>
          <FormField label="Period type"><FSelect value={form.periodType} onChange={set('periodType')} options={ptOpts} /></FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Start time *" error={errs.startTime}><FInput type="time" value={form.startTime} onChange={set('startTime')} /></FormField>
          <FormField label="End time *" error={errs.endTime}><FInput type="time" value={form.endTime} onChange={set('endTime')} /></FormField>
        </div>
        <FormField label="Subject"><FSelect value={form.subjectId} onChange={set('subjectId')} options={subOpts} /></FormField>
        <FormField label="Teacher"><FSelect value={form.teacherId} onChange={set('teacherId')} options={tchOpts} /></FormField>
        <FormField label="Room *" error={errs.roomId}>
          <FSelect value={form.roomId} onChange={set('roomId')} options={roomOpts} />
          {roomOpts.length === 0 && <p className="text-xs text-slate-500">No rooms found — add rooms in Master Data first.</p>}
        </FormField>
      </div>
      <div className="border-t border-slate-800 px-6 py-4 flex gap-2 justify-end flex-shrink-0">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={create.isPending || patch.isPending}>{(create.isPending || patch.isPending) ? 'Saving…' : editing ? 'Save changes' : 'Add entry'}</Button>
      </div>
    </Sheet>
  );
}

// ─── CSV Import Sheet ─────────────────────────────────────────────────────────
function ImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [validation, setValidation] = useState<TimetableImportValidation | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const fileRef = useRef<HTMLInputElement>(null);

  const validateMut = useMutation({
    mutationFn: (data: Row[]) => schoolApiPost<TimetableImportValidation>('/api/timetable/validate-import', { organizationId: ORG_ID, rows: data, commit: false }),
    onSuccess: (res) => { setValidation(res); setStep('preview'); },
  });

  const commitMut = useMutation({
    mutationFn: () => schoolApiPost('/api/timetable/validate-import', { organizationId: ORG_ID, rows, commit: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sm-timetable'] }); qc.invalidateQueries({ queryKey: ['sm-setup-health'] }); setStep('done'); },
  });

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? '');
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
      const parsed = lines.slice(1).map((line) => Object.fromEntries(headers.map((h, i) => [h, line.split(',')[i]?.trim().replace(/^"|"$/g, '') ?? ''])));
      setRows(parsed); validateMut.mutate(parsed);
    };
    reader.readAsText(file);
  };

  const reset = () => { setRows([]); setValidation(null); setStep('upload'); };

  return (
    <Sheet open={open} onClose={() => { onClose(); reset(); }}>
      <SHdr title="Import Timetable (CSV)" onClose={() => { onClose(); reset(); }} />
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {step === 'upload' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Use friendly names from Master Data (recommended), or numeric IDs. Each row is one period for one{' '}
              <strong className="text-slate-300">class + section</strong>.
            </p>
            <p className="text-xs text-slate-500">
              Columns: <code className="text-slate-400">className, sectionName, subjectName, teacherName, roomCode, day, startTime, endTime, periodType</code>
              {' '}(alternatively: sectionId, roomId, …)
            </p>
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => {
                const blob = new Blob(
                  [`className,sectionName,subjectName,teacherName,roomCode,day,startTime,endTime,periodType\nGrade 1,A,Mathematics,Teacher 1,R-001,Monday,08:00,08:45,Period\n`],
                  { type: 'text/csv' },
                );
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'timetable-template.csv';
                a.click();
              }}
            >
              Download template CSV
            </Button>
            <div className="rounded-lg border-2 border-dashed border-slate-700 p-8 text-center cursor-pointer hover:border-slate-500 transition-colors" onClick={() => fileRef.current?.click()}>
              <p className="text-sm text-slate-400">Click to select CSV</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
            {validateMut.isPending && <p className="text-xs text-slate-500">Validating…</p>}
          </div>
        )}
        {step === 'preview' && validation && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-300">{rows.length} row(s) parsed</p>
              <button onClick={reset} className="text-xs text-slate-500 hover:text-slate-300">← Re-upload</button>
            </div>
            {validation.errors?.length > 0 && (
              <div className="rounded bg-red-500/10 p-3 space-y-1">
                <p className="text-xs font-semibold text-red-400">Errors (must fix before importing):</p>
                {validation.errors.map((e: string, i: number) => <p key={i} className="text-xs text-red-400">{e}</p>)}
              </div>
            )}
            {validation.warnings?.length > 0 && (
              <div className="rounded bg-amber-500/10 p-3 space-y-1">
                <p className="text-xs font-semibold text-amber-400">Warnings:</p>
                {validation.warnings.map((w: string, i: number) => <p key={i} className="text-xs text-amber-400">{w}</p>)}
              </div>
            )}
            {!validation.errors?.length && <p className="text-xs text-green-400">✓ Validation passed — ready to import</p>}
            {validation.resolvedPreview && validation.resolvedPreview.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-800 max-h-48">
                <table className="w-full text-xs">
                  <thead className="bg-slate-900 text-slate-500">
                    <tr>
                      <th className="px-2 py-1 text-left">Class</th>
                      <th className="px-2 py-1 text-left">Section</th>
                      <th className="px-2 py-1 text-left">Subject</th>
                      <th className="px-2 py-1 text-left">Teacher</th>
                      <th className="px-2 py-1 text-left">Room</th>
                      <th className="px-2 py-1 text-left">Day</th>
                      <th className="px-2 py-1 text-left">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.resolvedPreview.slice(0, 15).map((r, i) => (
                      <tr
                        key={`${r.className}|${r.sectionName}|${r.dayOfWeek}|${r.startTime}|${r.roomCode}|${i}`}
                        className="border-t border-slate-800 text-slate-400"
                      >
                        <td className="px-2 py-1">{String(r.className)}</td>
                        <td className="px-2 py-1">{String(r.sectionName)}</td>
                        <td className="px-2 py-1">{String(r.subjectName)}</td>
                        <td className="px-2 py-1">{String(r.teacherName)}</td>
                        <td className="px-2 py-1 font-mono">{String(r.roomCode)}</td>
                        <td className="px-2 py-1">{DAYS[Number(r.dayOfWeek) - 1] ?? r.dayOfWeek}</td>
                        <td className="px-2 py-1 font-mono">{String(r.startTime)}–{String(r.endTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {step === 'done' && <p className="text-sm text-green-400 py-4 text-center">✓ Timetable imported successfully.</p>}
      </div>
      <div className="border-t border-slate-800 px-6 py-4 flex gap-2 justify-end flex-shrink-0">
        <Button variant="outline" onClick={() => { onClose(); reset(); }}>Close</Button>
        {step === 'preview' && !validation?.errors?.length && (
          <Button onClick={() => commitMut.mutate()} disabled={commitMut.isPending}>{commitMut.isPending ? 'Importing…' : `Commit ${rows.length} entries`}</Button>
        )}
      </div>
    </Sheet>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
type ViewMode = 'weekly' | 'section' | 'teacher' | 'room';

export default function TimetablePage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useTimetable();
  const { data: classes = [] } = useClasses();
  const { data: allSections = [] } = useQuery({ queryKey: ['sm-sections-all'], queryFn: () => schoolApiGet('/api/sections') });
  const [filterClassId, setFilterClassId] = useState('');
  const [filterSectionId, setFilterSectionId] = useState('');
  const { data: subjects = [] } = useSubjects();
  const { data: teachers = [] } = useTeachers();
  const { data: rooms = [] } = useRooms();
  const [view, setView] = useState<ViewMode>('weekly');
  const [entryOpen, setEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Row | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const entries: Row[] = Array.isArray(data) ? data : [];
  const allSec: Row[] = Array.isArray(allSections) ? allSections : [];
  const classList: Row[] = Array.isArray(classes) ? classes : [];

  const filteredEntries = useMemo(() => {
    let list = entries;
    if (filterClassId) {
      const secIds = new Set(
        allSec.filter((s) => String(s.classId) === filterClassId).map((s) => Number(s.id)),
      );
      list = list.filter((e) => secIds.has(Number(e.sectionId)));
    }
    if (filterSectionId) {
      list = list.filter((e) => String(e.sectionId) === filterSectionId);
    }
    return list;
  }, [entries, filterClassId, filterSectionId, allSec]);

  const sectionOptionsForClass = useMemo(() => {
    const secs = filterClassId
      ? allSec.filter((s) => String(s.classId) === filterClassId)
      : allSec;
    const classMap = Object.fromEntries(classList.map((c) => [String(c.id), c]));
    return secs.map((s) => ({ label: sectionLabel(s, classMap), value: String(s.id) }));
  }, [allSec, filterClassId, classList]);

  const deactivate = useMutation({
    mutationFn: (id: number) => schoolApiDelete(`/api/timetable/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sm-timetable'] }); qc.invalidateQueries({ queryKey: ['sm-setup-health'] }); },
  });

  const viewOpts: { id: ViewMode; label: string }[] = [
    { id: 'weekly', label: 'Weekly Grid' },
    { id: 'section', label: 'By Section' },
    { id: 'teacher', label: 'By Teacher' },
    { id: 'room', label: 'By Room' },
  ];

  return (
    <div className="space-y-6">
      <SMPageHeader
        title="Timetable"
        subtitle="Class schedules mapped to rooms and teachers. Overlap detection included."
        action={
          <div className="flex flex-wrap gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>Import CSV</Button>
            <Button size="sm" onClick={() => { setEditingEntry(null); setEntryOpen(true); }}>+ Add Entry</Button>
          </div>
        }
      />

      {!isLoading && entries.length === 0 && (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
          <p className="font-medium text-amber-100">No timetable entries yet</p>
          <p className="mt-1 text-xs text-amber-200/70">
            Add entries manually using <strong>+ Add Entry</strong>, or use <strong>Import CSV</strong> with the{' '}
            <a href="/samples/timetable-sample.csv" className="underline" download>
              sample file
            </a>.
            Ensure classes, sections, teachers, and rooms are configured in <strong>Master Data</strong> first.
          </p>
        </div>
      )}

      {/* Stats bar */}
      {!isLoading && entries.length > 0 && (
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          <span>{entries.length} total entries</span>
          <span>{new Set(entries.map((e) => e.sectionId)).size} section(s) scheduled</span>
          <span>{new Set(entries.filter((e) => e.teacherId).map((e) => e.teacherId)).size} teacher(s) assigned</span>
          <span>{new Set(entries.map((e) => e.roomId)).size} room(s) in use</span>
        </div>
      )}

      {/* Class / section filters — each grade+section has its own timetable */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3">
        <div className="space-y-1">
          <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">Class (grade)</label>
          <select
            className="h-9 min-w-[10rem] rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
            value={filterClassId}
            onChange={(e) => {
              setFilterClassId(e.target.value);
              setFilterSectionId('');
            }}
          >
            <option value="">All classes</option>
            {classList.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">Section</label>
          <select
            className="h-9 min-w-[12rem] rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
            value={filterSectionId}
            onChange={(e) => setFilterSectionId(e.target.value)}
            disabled={!filterClassId && sectionOptionsForClass.length > 30}
          >
            <option value="">All sections{filterClassId ? ' in class' : ''}</option>
            {sectionOptionsForClass.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {(filterClassId || filterSectionId) && (
          <button
            type="button"
            className="text-xs text-slate-500 hover:text-slate-300 pb-2"
            onClick={() => {
              setFilterClassId('');
              setFilterSectionId('');
            }}
          >
            Clear filters
          </button>
        )}
        <p className="pb-1 text-xs text-slate-500 max-w-md">
          Pick a class and section to see that group&apos;s weekly calendar. Import CSV with <code className="text-slate-400">className</code> + <code className="text-slate-400">sectionName</code> per row.
        </p>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 border-b border-slate-800 overflow-x-auto">
        {viewOpts.map((v) => (
          <button key={v.id} onClick={() => setView(v.id)} className={`whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${view === v.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>{v.label}</button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading timetable…</p>}
      {!isLoading && (
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/20 p-0">
          {view === 'weekly' && (
            <div className="p-1">
              {filterSectionId && (
                <p className="px-3 py-2 text-xs text-slate-400 border-b border-slate-800">
                  Showing schedule for:{' '}
                  <span className="text-slate-200 font-medium">
                    {sectionOptionsForClass.find((o) => o.value === filterSectionId)?.label ?? 'selected section'}
                  </span>
                </p>
              )}
              <WeeklyGrid
                entries={filteredEntries}
                sections={allSec}
                classes={classList}
                subjects={Array.isArray(subjects) ? subjects : []}
                teachers={Array.isArray(teachers) ? teachers : []}
                rooms={Array.isArray(rooms) ? rooms : []}
                onDelete={(id) => deactivate.mutate(id)}
                onEdit={(row) => { setEditingEntry(row); setEntryOpen(true); }}
              />
            </div>
          )}
          {view === 'section' && (
            <div className="p-4">
              <SectionView
                entries={filteredEntries}
                sections={allSec}
                classes={classList}
                subjects={Array.isArray(subjects) ? subjects : []}
                teachers={Array.isArray(teachers) ? teachers : []}
                rooms={Array.isArray(rooms) ? rooms : []}
                filterClassId={filterClassId}
                onEdit={(row) => { setEditingEntry(row); setEntryOpen(true); }}
              />
            </div>
          )}
          {view === 'teacher' && (
            <div className="p-4">
              <TeacherView
                entries={filteredEntries}
                teachers={Array.isArray(teachers) ? teachers : []}
                sections={allSec}
                subjects={Array.isArray(subjects) ? subjects : []}
                rooms={Array.isArray(rooms) ? rooms : []}
                onEdit={(row) => { setEditingEntry(row); setEntryOpen(true); }}
              />
            </div>
          )}
          {view === 'room' && (
            <div className="p-4">
              <RoomView
                entries={filteredEntries}
                rooms={Array.isArray(rooms) ? rooms : []}
                sections={allSec}
                subjects={Array.isArray(subjects) ? subjects : []}
                teachers={Array.isArray(teachers) ? teachers : []}
                onEdit={(row) => { setEditingEntry(row); setEntryOpen(true); }}
              />
            </div>
          )}
        </div>
      )}

      <EntrySheet
        open={entryOpen}
        onClose={() => { setEntryOpen(false); setEditingEntry(null); }}
        editing={editingEntry}
        allSections={allSec}
      />
      <ImportSheet open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
