'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SchoolDailyModuleView } from '@/components/school-intelligence/SchoolDailyModuleView';

type DisciplineEvent = {
  id: number; eventType: string; severity: string;
  detectedAt: string; description?: string; status: string;
  context?: Record<string, unknown>;
};

const DISCIPLINE_TYPES = [
  'RunningDetected', 'Loitering', 'RestrictedZoneEntry', 'UnsafeClimbing',
  'Discipline', 'EmergencyExitCrowding',
];

const TYPE_LABELS: Record<string, string> = {
  RunningDetected:       'Running',
  Loitering:             'Loitering',
  RestrictedZoneEntry:   'Restricted Zone',
  UnsafeClimbing:        'Unsafe Climbing',
  Discipline:            'General Discipline',
  EmergencyExitCrowding: 'Exit Crowding',
};

const TYPE_ICON: Record<string, string> = {
  RunningDetected:       '🏃',
  Loitering:             '🧍',
  RestrictedZoneEntry:   '🚫',
  UnsafeClimbing:        '🧗',
  Discipline:            '⚠️',
  EmergencyExitCrowding: '🚪',
};

const SEV_PILL: Record<string, string> = {
  critical: 'border-red-500/40 bg-red-500/10 text-red-400',
  high:     'border-orange-500/40 bg-orange-500/10 text-orange-400',
  medium:   'border-amber-500/40 bg-amber-500/10 text-amber-400',
  low:      'border-slate-600 bg-slate-700/40 text-slate-400',
};

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const SEV_BAR: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-amber-500',
  low:      'bg-slate-600',
};

function DisciplinePanel({ date, orgId }: { date: string; orgId: number }) {
  const [events, setEvents]         = useState<DisciplineEvent[]>([]);
  const [loading, setLoading]       = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sevFilter, setSevFilter]   = useState<string>('all');

  useEffect(() => {
    setLoading(true);
    // Fetch all relevant event types for this date
    const fetches = DISCIPLINE_TYPES.map((et) =>
      fetch(`/api/intelligence-events?organizationId=${orgId}&eventType=${et}&from=${date}&to=${date}`)
        .then((r) => r.json()).then((j) => j.events ?? []).catch(() => [])
    );
    void Promise.all(fetches).then((arrays) => {
      const all = (arrays.flat() as DisciplineEvent[]).sort(
        (a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9)
      );
      setEvents(all);
    }).finally(() => setLoading(false));
  }, [date, orgId]);

  // Count by type for summary chips
  const typeCounts = DISCIPLINE_TYPES.reduce<Record<string, number>>((acc, t) => {
    acc[t] = events.filter((e) => e.eventType === t).length;
    return acc;
  }, {});

  const filtered = events.filter((e) => {
    const typeOk = typeFilter === 'all' || e.eventType === typeFilter;
    const sevOk  = sevFilter === 'all'  || e.severity === sevFilter;
    return typeOk && sevOk;
  });

  const total    = events.length;
  const critical = events.filter((e) => e.severity === 'critical').length;
  const resolved = events.filter((e) => e.status === 'resolved').length;

  const severities = ['all', 'critical', 'high', 'medium', 'low'];

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total incidents',  value: total,    cls: total > 0 ? 'border-amber-900/40 bg-amber-950/10 text-amber-300'  : 'border-slate-800 bg-slate-900 text-slate-400' },
          { label: 'Critical',         value: critical, cls: critical > 0 ? 'border-red-900/40 bg-red-950/10 text-red-300'     : 'border-slate-800 bg-slate-900 text-slate-400' },
          { label: 'Resolved',         value: resolved, cls: 'border-green-900/40 bg-green-950/10 text-green-300' },
        ].map(({ label, value, cls }) => (
          <Card key={label} className={`border ${cls.split(' ')[0]}`}>
            <CardContent className={`p-3 ${cls}`}>
              <p className="text-xs opacity-70">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Type breakdown chips */}
      {total > 0 && (
        <div className="flex flex-wrap gap-2">
          {DISCIPLINE_TYPES.filter((t) => typeCounts[t] > 0).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                typeFilter === t
                  ? 'border-sky-600 bg-sky-900/40 text-sky-300'
                  : 'border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{TYPE_ICON[t] ?? '📌'}</span>
              {TYPE_LABELS[t] ?? t}
              <span className="rounded-full bg-slate-700 px-1.5 text-slate-300">{typeCounts[t]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Event list */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm text-slate-300">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Behaviour Events
              {filtered.length > 0 && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">{filtered.length}</span>
              )}
            </span>
            {/* Severity filter */}
            <div className="flex items-center gap-1">
              <Filter className="h-3 w-3 text-slate-500" />
              <div className="flex gap-0.5">
                {severities.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSevFilter(s)}
                    className={`rounded px-2 py-0.5 text-xs capitalize transition-colors ${
                      sevFilter === s ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading events…</p>
          ) : filtered.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-green-800/30 bg-green-950/10 px-4 py-3 text-sm text-green-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {total === 0 ? 'No discipline incidents for this date.' : 'No events match the current filter.'}
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.slice(0, 20).map((e) => (
                <li key={e.id} className="rounded-lg border border-slate-800 bg-slate-800/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-sm">{TYPE_ICON[e.eventType] ?? '📌'}</span>
                      <div>
                        <p className="text-sm font-medium text-slate-200">{TYPE_LABELS[e.eventType] ?? e.eventType}</p>
                        {e.description && <p className="mt-0.5 text-xs text-slate-400">{e.description}</p>}
                        <p className="mt-1 text-xs text-slate-600">
                          {new Date(e.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {e.status}
                        </p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium capitalize ${SEV_PILL[e.severity] ?? SEV_PILL.low}`}>
                      {e.severity}
                    </span>
                  </div>
                  {/* Severity bar */}
                  <div className="mt-2 h-0.5 rounded-full bg-slate-800">
                    <div className={`h-0.5 rounded-full ${SEV_BAR[e.severity] ?? 'bg-slate-600'}`} style={{ width: '100%' }} />
                  </div>
                </li>
              ))}
              {filtered.length > 20 && (
                <p className="pt-1 text-xs text-slate-500">{filtered.length - 20} more — view in Events Inbox.</p>
              )}
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
      module="discipline"
      title="Discipline Intelligence"
      description="Behaviour incidents — running, loitering, restricted-zone entries, and unsafe activity."
      icon={<AlertTriangle className="h-6 w-6" />}
      kpiKeys={[
        { key: 'running_count',   label: 'Running' },
        { key: 'loitering_count', label: 'Loitering' },
      ]}
      extra={(date, orgId) => <DisciplinePanel date={date} orgId={orgId} />}
    />
  );
}
