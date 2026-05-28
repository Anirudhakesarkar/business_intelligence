'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Clock, AlertCircle, CheckCircle2, XCircle, AlarmClock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SchoolDailyModuleView } from '@/components/school-intelligence/SchoolDailyModuleView';

type TEntry   = { id: number; sectionId: number; subjectId?: number; teacherId?: number; roomId: number; dayOfWeek: number; startTime: string; endTime: string; periodType: string };
type Teacher  = { id: number; name: string };
type Subject  = { id: number; name: string };
type Room     = { id: number; roomCode: string };
type Section  = { id: number; name: string };
type AcadEvent = { id: number; eventType: string; severity: string; detectedAt: string; description?: string; status: string };

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type PeriodState = 'conducted' | 'missed' | 'late' | 'live' | 'upcoming';

/** Per-period view driven by classroom_daily rows (room-level late/missed), with timetable time for live/upcoming. */
function derivePeriodState(
  start: string,
  end: string,
  date: string,
  roomLate: boolean,
  roomMissed: boolean,
): PeriodState {
  const today = new Date().toISOString().slice(0, 10);
  const now = nowHHMM();
  if (date === today && now >= start && now < end) return 'live';
  if (date === today && now < start) return 'upcoming';
  if (roomMissed) return 'missed';
  if (roomLate) return 'late';
  return 'conducted';
}

const STATE_CONFIG: Record<PeriodState, { icon: React.ReactNode; badge: string; row: string; label: string }> = {
  conducted: {
    icon:  <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />,
    badge: 'bg-green-500/10 text-green-400 border-green-500/30',
    row:   'border-slate-700 bg-slate-800/20',
    label: 'Conducted',
  },
  missed: {
    icon:  <XCircle className="h-3.5 w-3.5 text-red-400" />,
    badge: 'bg-red-500/10 text-red-400 border-red-500/30',
    row:   'border-red-900/40 bg-red-950/10',
    label: 'Missed',
  },
  live: {
    icon:  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />,
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    row:   'border-emerald-900/30 bg-emerald-950/5',
    label: 'Live',
  },
  upcoming: {
    icon:  <Clock className="h-3.5 w-3.5 text-sky-400" />,
    badge: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    row:   'border-slate-700 bg-slate-900/40',
    label: 'Upcoming',
  },
  late: {
    icon:  <AlarmClock className="h-3.5 w-3.5 text-amber-400" />,
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    row:   'border-amber-900/40 bg-amber-950/10',
    label: 'Late start',
  },
};

type ClassroomDailyRow = { roomId?: number; metrics?: Record<string, unknown> };

function roomMetricsFromClassroomDaily(rows: ClassroomDailyRow[]) {
  const byRoom: Record<number, { late: boolean; missed: boolean }> = {};
  for (const r of rows) {
    if (r.roomId == null) continue;
    const m = r.metrics ?? {};
    const late = Number(m.late_count ?? m.late_minutes ?? 0) > 0;
    const missed = Number(m.missed_count ?? 0) > 0;
    const cur = byRoom[r.roomId] ?? { late: false, missed: false };
    byRoom[r.roomId] = { late: cur.late || late, missed: cur.missed || missed };
  }
  return byRoom;
}

function AcademicPanel({ date, orgId }: { date: string; orgId: number }) {
  const [timetable, setTimetable] = useState<TEntry[]>([]);
  const [teachers, setTeachers]   = useState<Teacher[]>([]);
  const [subjects, setSubjects]   = useState<Subject[]>([]);
  const [rooms, setRooms]         = useState<Room[]>([]);
  const [sections, setSections]   = useState<Section[]>([]);
  const [events, setEvents]       = useState<AcadEvent[]>([]);
  const [classroomRows, setClassroomRows] = useState<ClassroomDailyRow[]>([]);
  const [headlineMetrics, setHeadlineMetrics] = useState<Record<string, number | string | null>>({});
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
      fetch(`/api/daily-summaries/classroom?organizationId=${orgId}&date=${encodeURIComponent(date)}`)
        .then((r) => r.json())
        .catch(() => ({ rows: [], headlineMetrics: {} })),
      fetch(`/api/intelligence-events?organizationId=${orgId}&from=${date}&to=${date}`)
        .then((r) => r.json()).then((j) => (j.events ?? []).filter((e: AcadEvent) =>
          ['MissedPeriod', 'ClassNotConducted', 'AcademicOperations'].includes(e.eventType)
        )).catch(() => []),
    ]).then(([tt, tc, sub, rm, sec, classroomJ, evts]) => {
      const cj = classroomJ && typeof classroomJ === 'object' ? (classroomJ as Record<string, unknown>) : {};
      setClassroomRows(Array.isArray(cj.rows) ? (cj.rows as ClassroomDailyRow[]) : []);
      setHeadlineMetrics(
        cj.headlineMetrics && typeof cj.headlineMetrics === 'object'
          ? (cj.headlineMetrics as Record<string, number | string | null>)
          : {},
      );
      const todayEntries = (Array.isArray(tt) ? tt : [])
        .filter((e: TEntry) => e.dayOfWeek === dow)
        .sort((a: TEntry, b: TEntry) => a.startTime.localeCompare(b.startTime));
      setTimetable(todayEntries);
      setTeachers(Array.isArray(tc) ? tc : []);
      setSubjects(Array.isArray(sub) ? sub : []);
      setRooms(Array.isArray(rm) ? rm : []);
      setSections(Array.isArray(sec) ? sec : []);
      setEvents(Array.isArray(evts) ? evts : []);
    }).finally(() => setLoading(false));
  }, [date, orgId]);

  const teacherMap = Object.fromEntries(teachers.map((t) => [t.id, t]));
  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]));
  const roomMap    = Object.fromEntries(rooms.map((r) => [r.id, r]));
  const sectionMap = Object.fromEntries(sections.map((s) => [s.id, s]));

  const roomFlags = roomMetricsFromClassroomDaily(classroomRows);

  const enriched = timetable.map((e) => {
    const rf = roomFlags[e.roomId] ?? { late: false, missed: false };
    const state = derivePeriodState(e.startTime, e.endTime, date, rf.late, rf.missed);
    return { entry: e, state };
  });

  const live      = enriched.filter((e) => e.state === 'live').length;
  const upcoming  = enriched.filter((e) => e.state === 'upcoming').length;
  const lateTbl   = enriched.filter((e) => e.state === 'late').length;
  const missedTbl = enriched.filter((e) => e.state === 'missed').length;
  const lateDaily = Number(headlineMetrics.late_count ?? 0);
  const missedDaily = Number(headlineMetrics.missed_count ?? 0);
  const lateShow = classroomRows.length ? lateDaily : lateTbl;
  const missedShow = classroomRows.length ? missedDaily : missedTbl;
  const dow       = new Date(date + 'T12:00:00').getDay();

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Live',       count: live,         cls: 'border-emerald-900/40 bg-emerald-950/10', txt: 'text-emerald-300' },
          { label: 'Upcoming',   count: upcoming,     cls: 'border-sky-900/40 bg-sky-950/10',        txt: 'text-sky-300' },
          { label: 'Late (day)', count: lateShow,     cls: 'border-amber-900/40 bg-amber-950/10',    txt: 'text-amber-300', hint: 'classroom_daily' },
          { label: 'Missed (day)', count: missedShow, cls: 'border-red-900/40 bg-red-950/10',       txt: 'text-red-300', hint: 'classroom_daily' },
        ].map(({ label, count, cls, txt, hint }) => (
          <Card key={label} className={`border ${cls}`}>
            <CardContent className="p-3">
              <p className={`text-xs ${txt} opacity-80`}>{label}</p>
              {hint && <p className="text-[10px] text-slate-500">{hint}</p>}
              <p className={`text-2xl font-bold ${txt}`}>{count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Period schedule */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm text-slate-300">
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-sky-400" />
              Period Schedule — {DAY_NAMES[dow]}
            </span>
            <span className="text-xs text-slate-500">
              {timetable.length} periods · status from classroom_daily (per room)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : enriched.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-700 py-6 text-center">
              <p className="text-sm text-slate-500">No periods scheduled for {DAY_NAMES[dow]}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Section</th>
                    <th className="px-3 py-2">Subject</th>
                    <th className="px-3 py-2">Teacher</th>
                    <th className="px-3 py-2">Room</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.map(({ entry: e, state }) => {
                    const cfg = STATE_CONFIG[state];
                    return (
                      <tr key={e.id} className={`border-t border-slate-800 text-slate-300 ${state === 'missed' || state === 'late' ? 'opacity-90' : ''}`}>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">
                          <div className="flex items-center gap-1.5">{cfg.icon} {e.startTime}–{e.endTime}</div>
                        </td>
                        <td className="px-3 py-2 font-medium">{sectionMap[e.sectionId]?.name ?? `#${e.sectionId}`}</td>
                        <td className="px-3 py-2 text-slate-400">{e.subjectId ? (subjectMap[e.subjectId]?.name ?? '—') : '—'}</td>
                        <td className="px-3 py-2 text-slate-400">{e.teacherId ? (teacherMap[e.teacherId]?.name ?? '—') : <span className="italic text-slate-600">Unassigned</span>}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">{roomMap[e.roomId]?.roomCode ?? '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${cfg.badge}`}>{cfg.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Missed/anomaly events */}
      {events.length > 0 && (
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
              <AlertCircle className="h-4 w-4 text-red-400" /> Academic Anomalies
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400">{events.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {events.slice(0, 8).map((ev) => (
                <li key={ev.id} className="flex items-start justify-between gap-3 rounded-lg border border-red-900/30 bg-red-950/10 p-3">
                  <p className="text-sm text-slate-300">{ev.description ?? ev.eventType}</p>
                  <span className="shrink-0 text-xs text-slate-500">
                    {new Date(ev.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {events.length === 0 && !loading && missedShow === 0 && lateShow === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-green-800/30 bg-green-950/10 px-4 py-3 text-sm text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> No late or missed signals in classroom_daily; no rule-engine academic events.
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <SchoolDailyModuleView
      module="classroom"
      title="Academic Operations"
      description="Scheduled vs conducted periods — punctuality, missed classes, and coverage."
      icon={<BookOpen className="h-6 w-6" />}
      kpiKeys={[
        { key: 'conducted_pct', label: 'Conducted %' },
        { key: 'late_count',    label: 'Late periods' },
        { key: 'missed_count',  label: 'Missed' },
      ]}
      extra={(date, orgId) => <AcademicPanel date={date} orgId={orgId} />}
    />
  );
}
