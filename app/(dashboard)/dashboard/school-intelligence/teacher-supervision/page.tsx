'use client';

import { useEffect, useState } from 'react';
import { UserCheck, Users, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SchoolDailyModuleView } from '@/components/school-intelligence/SchoolDailyModuleView';

type Teacher    = { id: number; name: string; employeeCode?: string };
type TEntry     = { id: number; teacherId?: number; sectionId: number; startTime: string; endTime: string; dayOfWeek: number; periodType: string };
type GapEvent   = { id: number; eventType: string; severity: string; detectedAt: string; status: string; description?: string; context?: Record<string, unknown> };
type Section    = { id: number; name: string };

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const SEV_PILL: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/30',
  high:     'bg-orange-500/10 text-orange-400 border-orange-500/30',
  medium:   'bg-amber-500/10 text-amber-400 border-amber-500/30',
  low:      'bg-slate-700 text-slate-400 border-slate-600',
};

function SupervisionPanel({ date, orgId }: { date: string; orgId: number }) {
  const [teachers, setTeachers]   = useState<Teacher[]>([]);
  const [timetable, setTimetable] = useState<TEntry[]>([]);
  const [sections, setSections]   = useState<Section[]>([]);
  const [gaps, setGaps]           = useState<GapEvent[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    setLoading(true);
    const dow = new Date(date + 'T12:00:00').getDay();
    void Promise.all([
      fetch(`/api/teachers?organizationId=${orgId}`).then((r) => r.json()),
      fetch(`/api/timetable?organizationId=${orgId}`).then((r) => r.json()),
      fetch(`/api/sections`).then((r) => r.json()),
      fetch(`/api/intelligence-events?organizationId=${orgId}&eventType=TeacherSupervisionGap&from=${date}&to=${date}`)
        .then((r) => r.json()).then((j) => j.events ?? []).catch(() => []),
    ]).then(([tc, tt, sec, gapEvts]) => {
      const todayEntries = (Array.isArray(tt) ? tt : []).filter((e: TEntry) => e.dayOfWeek === dow);
      setTeachers(Array.isArray(tc) ? tc : []);
      setTimetable(todayEntries);
      setSections(Array.isArray(sec) ? sec : []);
      setGaps(
        (Array.isArray(gapEvts) ? gapEvts : []).sort(
          (a: GapEvent, b: GapEvent) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9)
        )
      );
    }).finally(() => setLoading(false));
  }, [date, orgId]);

  const secMap  = Object.fromEntries(sections.map((s) => [s.id, s]));

  // Per-teacher: how many periods they have today
  const teacherPeriods = teachers.map((t) => ({
    teacher: t,
    periods: timetable.filter((e) => e.teacherId === t.id),
    gaps:    gaps.filter((g) => g.context && (g.context as Record<string, unknown>).teacherId === t.id),
  })).filter((tp) => tp.periods.length > 0)
    .sort((a, b) => b.gaps.length - a.gaps.length);

  // Unassigned periods (no teacher)
  const unassigned = timetable.filter((e) => !e.teacherId);

  return (
    <div className="space-y-5">
      {/* Gap summary per teacher */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm text-slate-300">
            <span className="flex items-center gap-2"><Users className="h-4 w-4 text-sky-400" /> Teacher Assignment Summary</span>
            <span className="text-xs text-slate-500">{teacherPeriods.length} teachers active today</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : teacherPeriods.length === 0 ? (
            <p className="text-sm text-slate-500">No timetable assignments found for this day.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Teacher</th>
                    <th className="px-3 py-2">Periods</th>
                    <th className="px-3 py-2">Sections</th>
                    <th className="px-3 py-2">Gaps</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherPeriods.map(({ teacher, periods, gaps: tGaps }) => (
                    <tr key={teacher.id} className="border-t border-slate-800 text-slate-300 hover:bg-slate-800/30">
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-200">{teacher.name}</p>
                        {teacher.employeeCode && <p className="text-xs text-slate-600">{teacher.employeeCode}</p>}
                      </td>
                      <td className="px-3 py-2 text-slate-400">{periods.length}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {periods.slice(0, 3).map((p) => secMap[p.sectionId]?.name ?? `#${p.sectionId}`).join(', ')}
                        {periods.length > 3 && ` +${periods.length - 3}`}
                      </td>
                      <td className="px-3 py-2">
                        {tGaps.length > 0 ? (
                          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-400">{tGaps.length}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {tGaps.length === 0 ? (
                          <span className="text-xs text-green-400">✓ Clear</span>
                        ) : (
                          <span className="text-xs text-amber-400">⚠ Gaps</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {unassigned.length > 0 && (
            <p className="mt-3 text-xs text-amber-500">
              <AlertTriangle className="mr-1 inline h-3 w-3" />
              {unassigned.length} period{unassigned.length > 1 ? 's' : ''} with no teacher assigned today.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Supervision gap events list */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm text-slate-300">
            <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400" /> Gap Events</span>
            {gaps.length > 0 && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">{gaps.length}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : gaps.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-green-800/30 bg-green-950/10 px-4 py-3 text-sm text-green-300">
              <UserCheck className="h-4 w-4 shrink-0" /> No supervision gaps for this date.
            </div>
          ) : (
            <ul className="space-y-2">
              {gaps.slice(0, 12).map((g) => (
                <li key={g.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-800/30 p-3">
                  <div>
                    <p className="text-sm text-slate-300">{g.description ?? 'Supervision gap detected'}</p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {new Date(g.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {g.status}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-xs capitalize ${SEV_PILL[g.severity] ?? SEV_PILL.low}`}>
                    {g.severity}
                  </span>
                </li>
              ))}
              {gaps.length > 12 && <p className="text-xs text-slate-500">{gaps.length - 12} more in Events Inbox.</p>}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <SchoolDailyModuleView
      module="teacher"
      title="Teacher Presence & Supervision"
      description="Supervision gaps, presence, and class conduct."
      icon={<UserCheck className="h-6 w-6" />}
      kpiKeys={[
        { key: 'gap_count',      label: 'Supervision gaps' },
        { key: 'presence_pct',   label: 'Presence %' },
        { key: 'conducted_pct',  label: 'Classes conducted %' },
      ]}
      extra={(date, orgId) => <SupervisionPanel date={date} orgId={orgId} />}
    />
  );
}
