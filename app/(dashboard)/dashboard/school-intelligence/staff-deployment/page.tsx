'use client';

import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle2, Clock, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SchoolDailyModuleView } from '@/components/school-intelligence/SchoolDailyModuleView';

type DutyRoster  = { id: number; staffMemberId: number; zoneId?: number; dutyType: string; dayOfWeek: number; startTime: string; endTime: string; isCriticalWindow: boolean; isActive: boolean };
type StaffMember = { id: number; name: string; role: string; employeeCode?: string };
type Zone        = { id: number; name: string; zoneType: string; isRiskZone: boolean };
type StaffEvent  = { id: number; eventType: string; severity: string; detectedAt: string; description?: string; status: string };

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function shiftStatus(start: string, end: string, date: string): 'active' | 'done' | 'upcoming' {
  const today = new Date().toISOString().slice(0, 10);
  if (date !== today) return 'done';
  const now = nowHHMM();
  if (now >= start && now < end) return 'active';
  if (now >= end) return 'done';
  return 'upcoming';
}

const SHIFT_STYLE = {
  active:   { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', label: 'Active' },
  done:     { badge: 'bg-slate-700/40 text-slate-500 border-slate-700',          label: 'Done' },
  upcoming: { badge: 'bg-sky-500/10 text-sky-400 border-sky-500/30',             label: 'Upcoming' },
};

const DUTY_COLORS: Record<string, string> = {
  Security:       'text-red-400',
  GateStaff:      'text-orange-400',
  Admin:          'text-sky-400',
  Peon:           'text-slate-400',
  Librarian:      'text-indigo-400',
  'Lab Assistant':'text-purple-400',
  'Sports Coach': 'text-green-400',
  Counselor:      'text-amber-400',
  Receptionist:   'text-pink-400',
  Driver:         'text-cyan-400',
  Cleaner:        'text-teal-400',
};

function StaffDeploymentPanel({ date, orgId }: { date: string; orgId: number }) {
  const [rosters, setRosters]   = useState<DutyRoster[]>([]);
  const [staff, setStaff]       = useState<StaffMember[]>([]);
  const [zones, setZones]       = useState<Zone[]>([]);
  const [events, setEvents]     = useState<StaffEvent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>('all');

  useEffect(() => {
    setLoading(true);
    const dow = new Date(date + 'T12:00:00').getDay();
    void Promise.all([
      fetch(`/api/staff-duty-rosters?organizationId=${orgId}`).then((r) => r.json()),
      fetch(`/api/staff-members?organizationId=${orgId}`).then((r) => r.json()),
      fetch(`/api/zones`).then((r) => r.json()),
      fetch(`/api/intelligence-events?organizationId=${orgId}&from=${date}&to=${date}`)
        .then((r) => r.json())
        .then((j) => (j.events ?? []).filter((e: StaffEvent) =>
          ['StaffMissingAtGate', 'StaffMissingAtPlayground', 'StaffDeployment'].includes(e.eventType)
        )).catch(() => []),
    ]).then(([ros, st, zn, evts]) => {
      const todayRosters = (Array.isArray(ros) ? ros : []).filter((r: DutyRoster) => r.dayOfWeek === dow);
      setRosters(todayRosters);
      setStaff(Array.isArray(st) ? st : []);
      setZones(Array.isArray(zn) ? zn : []);
      setEvents(Array.isArray(evts) ? evts : []);
    }).finally(() => setLoading(false));
  }, [date, orgId]);

  const staffMap = Object.fromEntries(staff.map((s) => [s.id, s]));
  const zoneMap  = Object.fromEntries(zones.map((z) => [z.id, z]));
  const dow      = new Date(date + 'T12:00:00').getDay();

  const roles = ['all', ...Array.from(new Set(staff.map((s) => s.role))).sort()];

  const enriched = rosters
    .map((r) => {
      const member = staffMap[r.staffMemberId];
      const zone   = r.zoneId != null ? zoneMap[r.zoneId] : null;
      const status = shiftStatus(r.startTime, r.endTime, date);
      return { roster: r, member, zone, status };
    })
    .filter(({ member }) => roleFilter === 'all' || member?.role === roleFilter)
    .sort((a, b) => a.roster.startTime.localeCompare(b.roster.startTime));

  const active   = enriched.filter((e) => e.status === 'active').length;
  const critical = rosters.filter((r) => r.isCriticalWindow).length;
  const missing  = events.filter((e) => ['StaffMissingAtGate', 'StaffMissingAtPlayground'].includes(e.eventType)).length;

  return (
    <div className="space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Active shifts',    value: active,              cls: 'border-emerald-900/40 bg-emerald-950/10 text-emerald-300' },
          { label: 'Critical windows', value: critical,            cls: 'border-amber-900/40 bg-amber-950/10 text-amber-300' },
          { label: 'Missing alerts',   value: missing,             cls: missing > 0 ? 'border-red-900/40 bg-red-950/10 text-red-300' : 'border-slate-800 bg-slate-900 text-slate-400' },
        ].map(({ label, value, cls }) => (
          <Card key={label} className={`border ${cls.split(' ')[0]}`}>
            <CardContent className={`p-3 ${cls}`}>
              <p className="text-xs opacity-70">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Duty roster */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm text-slate-300">
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-sky-400" />
              Duty Roster — {DAY_NAMES[dow]}
            </span>
            <span className="text-xs text-slate-500">{rosters.length} shift{rosters.length !== 1 ? 's' : ''}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Role filter chips */}
          {roles.length > 2 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {roles.map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors capitalize ${
                    roleFilter === r
                      ? 'border-sky-600 bg-sky-900/40 text-sky-300'
                      : 'border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-slate-500">Loading roster…</p>
          ) : enriched.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-700 py-8 text-center">
              <Shield className="mx-auto mb-2 h-8 w-8 text-slate-700" />
              <p className="text-sm text-slate-500">No duty shifts for {DAY_NAMES[dow]}.</p>
              <p className="mt-1 text-xs text-slate-600">Add rosters via Calendar & Roster in School Management.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Staff member</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Duty type</th>
                    <th className="px-3 py-2">Zone</th>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Critical</th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.map(({ roster, member, zone, status }) => {
                    const cfg = SHIFT_STYLE[status];
                    const roleColor = member ? (DUTY_COLORS[member.role] ?? 'text-slate-400') : 'text-slate-600';
                    return (
                      <tr key={roster.id} className="border-t border-slate-800 text-slate-300 hover:bg-slate-800/30">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-slate-500" />
                            <span className="font-medium text-slate-200">{member?.name ?? `Staff #${roster.staffMemberId}`}</span>
                          </div>
                          {member?.employeeCode && <p className="pl-4.5 text-xs text-slate-600">{member.employeeCode}</p>}
                        </td>
                        <td className={`px-3 py-2 text-xs font-medium ${roleColor}`}>{member?.role ?? '—'}</td>
                        <td className="px-3 py-2 text-xs text-slate-400">{roster.dutyType}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">
                          {zone ? (
                            <>
                              {zone.name}
                              {zone.isRiskZone && <span className="ml-1 text-amber-500">⚠</span>}
                            </>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-400">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {roster.startTime}–{roster.endTime}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${cfg.badge}`}>{cfg.label}</span>
                        </td>
                        <td className="px-3 py-2">
                          {roster.isCriticalWindow
                            ? <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-400">Critical</span>
                            : <span className="text-slate-600">—</span>}
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

      {/* Missing / deployment alerts */}
      {events.length > 0 && (
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
              <AlertTriangle className="h-4 w-4 text-red-400" /> Deployment Alerts
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400">{events.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {events.slice(0, 8).map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 rounded-lg border border-red-900/30 bg-red-950/10 p-3">
                  <p className="text-sm text-slate-300">{e.description ?? e.eventType}</p>
                  <span className="shrink-0 text-xs text-slate-500">
                    {new Date(e.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {events.length === 0 && !loading && (
        <div className="flex items-center gap-2 rounded-lg border border-green-800/30 bg-green-950/10 px-4 py-3 text-sm text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> All posts covered — no missing-staff alerts for this date.
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <SchoolDailyModuleView
      module="staff"
      title="Staff Deployment"
      description="Duty roster coverage — shifts, critical windows, and missing-staff alerts."
      icon={<Shield className="h-6 w-6" />}
      kpiKeys={[{ key: 'coverage_pct', label: 'Coverage %' }]}
      extra={(date, orgId) => <StaffDeploymentPanel date={date} orgId={orgId} />}
    />
  );
}
