'use client';

import { useEffect, useState } from 'react';
import { UserCheck, Clock, AlertCircle, BookOpen, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SchoolDailyModuleView } from '@/components/school-intelligence/SchoolDailyModuleView';

// ── types ────────────────────────────────────────────────────────────────────
type TimetableEntry = {
  id: number; sectionId: number; subjectId?: number; roomId: number;
  teacherId?: number; periodType: string; dayOfWeek: number;
  startTime: string; endTime: string; isActive: boolean;
};
type Teacher  = { id: number; name: string; employeeCode?: string };
type Subject  = { id: number; name: string; subjectCode?: string };
type Room     = { id: number; roomCode: string; roomName: string };
type Section  = { id: number; name: string; classId: number };
type GapEvent = { id: number; eventType: string; severity: string; detectedAt: string; status: string; description?: string };

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function periodStatus(start: string, end: string, date: string): 'live' | 'done' | 'upcoming' {
  const todayIso = new Date().toISOString().slice(0, 10);
  if (date !== todayIso) return 'done';
  const now = nowHHMM();
  if (now >= start && now < end) return 'live';
  if (now >= end) return 'done';
  return 'upcoming';
}

const STATUS_CONFIG = {
  live:     { cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', label: 'Live' },
  done:     { cls: 'bg-slate-700/40 text-slate-500 border-slate-700',          label: 'Done' },
  upcoming: { cls: 'bg-sky-500/10 text-sky-400 border-sky-500/30',             label: 'Upcoming' },
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'border-l-red-500 bg-red-950/10',
  high:     'border-l-orange-500 bg-orange-950/10',
  medium:   'border-l-amber-500 bg-amber-950/10',
  low:      'border-l-slate-600 bg-slate-900/40',
};

// ── live data panel ───────────────────────────────────────────────────────────
function TeacherLivePanel({ date, orgId }: { date: string; orgId: number }) {
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [teachers, setTeachers]   = useState<Teacher[]>([]);
  const [subjects, setSubjects]   = useState<Subject[]>([]);
  const [rooms, setRooms]         = useState<Room[]>([]);
  const [sections, setSections]   = useState<Section[]>([]);
  const [gaps, setGaps]           = useState<GapEvent[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    setLoading(true);
    const dow = new Date(date + 'T12:00:00').getDay();
    void Promise.all([
      fetch(`/api/timetable?organizationId=${orgId}`).then((r) => r.json()),
      fetch(`/api/teachers?organizationId=${orgId}`).then((r) => r.json()),
      fetch(`/api/subjects?organizationId=${orgId}`).then((r) => r.json()),
      fetch(`/api/rooms?organizationId=${orgId}`).then((r) => r.json()),
      fetch(`/api/sections`).then((r) => r.json()),
      fetch(`/api/intelligence-events?organizationId=${orgId}&eventType=TeacherSupervisionGap&from=${date}&to=${date}`)
        .then((r) => r.json()).then((j) => j.events ?? []).catch(() => []),
    ]).then(([tt, tc, sub, rm, sec, gapEvts]) => {
      const entries = (Array.isArray(tt) ? tt : []).filter((e: TimetableEntry) => e.dayOfWeek === dow);
      setTimetable(entries);
      setTeachers(Array.isArray(tc) ? tc : []);
      setSubjects(Array.isArray(sub) ? sub : []);
      setRooms(Array.isArray(rm) ? rm : []);
      setSections(Array.isArray(sec) ? sec : []);
      setGaps(Array.isArray(gapEvts) ? gapEvts : []);
    }).finally(() => setLoading(false));
  }, [date, orgId]);

  const teacherMap = Object.fromEntries(teachers.map((t) => [t.id, t]));
  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]));
  const roomMap    = Object.fromEntries(rooms.map((r) => [r.id, r]));
  const sectionMap = Object.fromEntries(sections.map((s) => [s.id, s]));

  const grouped = timetable.reduce<Record<string, TimetableEntry[]>>((acc, e) => {
    (acc[e.startTime] ??= []).push(e);
    return acc;
  }, {});
  const slots = Object.keys(grouped).sort();
  const dow   = new Date(date + 'T12:00:00').getDay();

  return (
    <div className="space-y-5">
      {/* Timetable for the selected day */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm text-slate-300">
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-sky-400" />
              Schedule — {DAY_NAMES[dow]}
            </span>
            <span className="text-xs text-slate-500">{timetable.length} period{timetable.length !== 1 ? 's' : ''}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading timetable…</p>
          ) : slots.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-700 py-6 text-center">
              <p className="text-sm text-slate-500">No timetable entries for {DAY_NAMES[dow]}.</p>
              <p className="mt-1 text-xs text-slate-600">Seed demo data from Master Data to populate the timetable.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {slots.map((slot) => {
                const entries = grouped[slot];
                const first   = entries[0];
                const status  = periodStatus(first.startTime, first.endTime, date);
                const cfg     = STATUS_CONFIG[status];
                return (
                  <div key={slot} className="rounded-lg border border-slate-800 bg-slate-800/30 p-3">
                    <div className="mb-2 flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Clock className="h-3.5 w-3.5" />
                        {first.startTime} – {first.endTime}
                      </div>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${cfg.cls}`}>{cfg.label}</span>
                      <span className="text-xs text-slate-600">{first.periodType}</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {entries.map((e) => {
                        const teacher = e.teacherId != null ? teacherMap[e.teacherId] : null;
                        const subject = e.subjectId != null ? subjectMap[e.subjectId] : null;
                        const room    = roomMap[e.roomId];
                        const section = sectionMap[e.sectionId];
                        return (
                          <div key={e.id} className="rounded-md border border-slate-700 bg-slate-900 p-2 text-xs">
                            <p className="font-medium text-slate-200">
                              {section?.name ?? `Sec ${e.sectionId}`}
                              {subject && <span className="ml-1.5 text-slate-500">· {subject.name}</span>}
                            </p>
                            <div className="mt-1 flex items-center gap-1 text-slate-400">
                              <User className="h-3 w-3" />
                              {teacher ? teacher.name : <span className="italic text-slate-600">No teacher</span>}
                            </div>
                            {room && <p className="mt-0.5 font-mono text-slate-600">{room.roomCode}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supervision gap events */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm text-slate-300">
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              Supervision Gaps
            </span>
            {gaps.length > 0 && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">{gaps.length} detected</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : gaps.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-green-800/30 bg-green-950/10 px-4 py-3 text-sm text-green-300">
              <UserCheck className="h-4 w-4 shrink-0" />
              No supervision gaps detected for this date.
            </div>
          ) : (
            <ul className="space-y-2">
              {gaps.slice(0, 10).map((g) => (
                <li
                  key={g.id}
                  className={`rounded-lg border-l-4 border border-slate-800 p-3 ${SEVERITY_COLORS[g.severity] ?? SEVERITY_COLORS.low}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-slate-300">{g.description ?? g.eventType}</p>
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-xs capitalize ${
                      g.severity === 'critical' ? 'border-red-700/50 bg-red-900/30 text-red-300' :
                      g.severity === 'high'     ? 'border-orange-700/50 bg-orange-900/30 text-orange-300' :
                                                  'border-amber-700/50 bg-amber-900/30 text-amber-300'
                    }`}>{g.severity}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {new Date(g.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {g.status}
                  </p>
                </li>
              ))}
              {gaps.length > 10 && (
                <p className="pt-1 text-xs text-slate-500">{gaps.length - 10} more — see Events Inbox for the full list.</p>
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────
export default function Page() {
  return (
    <SchoolDailyModuleView
      module="teacher"
      title="Teacher Productivity Intelligence"
      description="Class conduct, presence, punctuality, and teaching-zone activity."
      icon={<UserCheck className="h-6 w-6" />}
      kpiKeys={[
        { key: 'conducted_pct', label: 'Class conducted %' },
        { key: 'presence_pct',  label: 'Teacher presence %' },
        { key: 'on_time_pct',   label: 'On-time start %' },
        { key: 'gap_count',     label: 'Supervision gaps' },
      ]}
      extra={(date, orgId) => <TeacherLivePanel date={date} orgId={orgId} />}
    />
  );
}
