'use client';

import { useEffect, useState } from 'react';
import { ClipboardCheck, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SchoolDailyModuleView } from '@/components/school-intelligence/SchoolDailyModuleView';

type CompEvent = { id: number; eventType: string; severity: string; detectedAt: string; description?: string; status: string };

const COMPLIANCE_TYPES = [
  'FireExitObstruction', 'RestrictedZoneEntry', 'Compliance',
  'ServerRoomEntry', 'EmergencyExitCrowding',
];

const TYPE_LABELS: Record<string, string> = {
  FireExitObstruction:   'Fire Exit Blocked',
  RestrictedZoneEntry:   'Restricted Zone Entry',
  Compliance:            'Compliance Violation',
  ServerRoomEntry:       'Server Room Entry',
  EmergencyExitCrowding: 'Emergency Exit Crowding',
};

const TYPE_ICON: Record<string, string> = {
  FireExitObstruction:   '🚒',
  RestrictedZoneEntry:   '🚫',
  Compliance:            '📋',
  ServerRoomEntry:       '🖥️',
  EmergencyExitCrowding: '🚪',
};

const SEV_PILL: Record<string, string> = {
  critical: 'border-red-500/40 bg-red-500/10 text-red-400',
  high:     'border-orange-500/40 bg-orange-500/10 text-orange-400',
  medium:   'border-amber-500/40 bg-amber-500/10 text-amber-400',
  low:      'border-slate-600 bg-slate-700/40 text-slate-400',
};

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function CompliancePanel({ date, orgId }: { date: string; orgId: number }) {
  const [events, setEvents]   = useState<CompEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fetches = COMPLIANCE_TYPES.map((et) =>
      fetch(`/api/intelligence-events?organizationId=${orgId}&eventType=${et}&from=${date}&to=${date}`)
        .then((r) => r.json()).then((j) => j.events ?? []).catch(() => [])
    );
    void Promise.all(fetches).then((arrays) => {
      const all = (arrays.flat() as CompEvent[]).sort(
        (a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9)
      );
      setEvents(all);
    }).finally(() => setLoading(false));
  }, [date, orgId]);

  // Count by type
  const typeCounts = COMPLIANCE_TYPES.reduce<Record<string, number>>((acc, t) => {
    acc[t] = events.filter((e) => e.eventType === t).length;
    return acc;
  }, {});

  const total    = events.length;
  const critical = events.filter((e) => e.severity === 'critical').length;
  const open     = events.filter((e) => e.status === 'open').length;

  // Checklist items — green if no events of that type
  const checklistItems = COMPLIANCE_TYPES.map((t) => ({
    type: t,
    label: TYPE_LABELS[t] ?? t,
    icon:  TYPE_ICON[t] ?? '📋',
    count: typeCounts[t],
    ok:    typeCounts[t] === 0,
  }));

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total violations', value: total,    cls: total > 0 ? 'border-red-900/40 bg-red-950/10 text-red-300' : 'border-slate-800 bg-slate-900 text-slate-400' },
          { label: 'Critical',         value: critical, cls: critical > 0 ? 'border-red-900/40 bg-red-950/10 text-red-300' : 'border-slate-800 bg-slate-900 text-slate-400' },
          { label: 'Open',             value: open,     cls: open > 0 ? 'border-amber-900/40 bg-amber-950/10 text-amber-300' : 'border-green-900/40 bg-green-950/10 text-green-300' },
        ].map(({ label, value, cls }) => (
          <Card key={label} className={`border ${cls.split(' ')[0]}`}>
            <CardContent className={`p-3 ${cls}`}>
              <p className="text-xs opacity-70">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Compliance checklist */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
            <ClipboardCheck className="h-4 w-4 text-sky-400" />
            Compliance Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="space-y-2">
              {checklistItems.map(({ type, label, icon, count, ok }) => (
                <div
                  key={type}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    ok ? 'border-green-800/30 bg-green-950/5' : 'border-red-800/30 bg-red-950/10'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {ok
                      ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                      : <XCircle className="h-4 w-4 shrink-0 text-red-400" />}
                    <span className="text-sm">{icon}</span>
                    <span className={`text-sm ${ok ? 'text-slate-300' : 'text-red-300'}`}>{label}</span>
                  </div>
                  {count > 0 && (
                    <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400">{count} violation{count > 1 ? 's' : ''}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Violation event list */}
      {events.length > 0 && (
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              Violation Events
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400">{events.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {events.slice(0, 12).map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 rounded-lg border border-red-900/30 bg-red-950/5 p-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{TYPE_ICON[e.eventType] ?? '📋'}</span>
                      <p className="text-sm font-medium text-slate-200">{TYPE_LABELS[e.eventType] ?? e.eventType}</p>
                    </div>
                    {e.description && <p className="mt-0.5 pl-5 text-xs text-slate-400">{e.description}</p>}
                    <p className="mt-1 pl-5 text-xs text-slate-600">
                      {new Date(e.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {e.status}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-xs capitalize ${SEV_PILL[e.severity] ?? SEV_PILL.low}`}>
                    {e.severity}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {events.length === 0 && !loading && (
        <div className="flex items-center gap-2 rounded-lg border border-green-800/30 bg-green-950/10 px-4 py-3 text-sm text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Full compliance — no violations detected for this date.
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <SchoolDailyModuleView
      module="compliance"
      title="Compliance Intelligence"
      description="Violations rollup — fire exits, restricted zones, server room, and regulatory checks."
      icon={<ClipboardCheck className="h-6 w-6" />}
      kpiKeys={[{ key: 'violation_count', label: 'Violations' }]}
      extra={(date, orgId) => <CompliancePanel date={date} orgId={orgId} />}
    />
  );
}
