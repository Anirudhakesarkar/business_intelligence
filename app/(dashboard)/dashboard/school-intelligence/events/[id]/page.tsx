'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { SIPageShell } from '@/components/school-intelligence/SIPageShell';
import { SISection } from '@/components/school-intelligence/SISection';
import { useIntelligenceEvent } from '@/components/school-intelligence/useSchoolRuleEngine';
import { schoolFetch } from '@/lib/school-auth/client-fetch';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Camera,
  Clock,
  ShieldCheck,
  User,
  FileText,
  MapPin,
  ArrowRight,
  Loader2,
} from 'lucide-react';

type FullEvent = {
  id: number;
  eventType: string;
  module: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'Acknowledged' | 'Assigned' | 'Resolved';
  startedAt: string;
  endedAt?: string;
  cameraId?: number;
  zoneId?: number;
  roomId?: number;
  ruleId?: number;
  classId?: number;
  periodId?: number;
  confidence?: number;
  evidence: {
    summary: string;
    metrics?: Record<string, number | string>;
    signalIds?: number[];
  };
  assignedTo?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
};

type Ack = {
  id: number;
  action: 'ack' | 'assign' | 'resolve';
  note?: string;
  createdAt: string;
};

type EventDetailContext = {
  ruleName?: string;
  roomName?: string;
  zoneName?: string;
  className?: string;
  sectionName?: string;
  subjectName?: string;
  periodLabel?: string;
  timeWindow?: string;
  calendarDayType?: string;
  processOwner?: string;
  dutyRosterRole?: string;
  cameraPurpose?: string;
};

const SEVERITY_CONFIG = {
  Low: { icon: AlertCircle, badge: 'bg-sky-500/10 text-sky-300 ring-sky-500/30', dot: 'bg-sky-400' },
  Medium: { icon: AlertTriangle, badge: 'bg-amber-500/10 text-amber-300 ring-amber-500/30', dot: 'bg-amber-400' },
  High: { icon: AlertTriangle, badge: 'bg-orange-500/10 text-orange-300 ring-orange-500/30', dot: 'bg-orange-400' },
  Critical: { icon: AlertCircle, badge: 'bg-rose-500/10 text-rose-300 ring-rose-500/30', dot: 'bg-rose-400' },
};

const STATUS_BADGE: Record<string, string> = {
  Open: 'bg-rose-500/10 text-rose-300 ring-rose-500/30',
  Acknowledged: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
  Assigned: 'bg-sky-500/10 text-sky-300 ring-sky-500/30',
  Resolved: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
};

const ACK_LABELS: Record<string, string> = { ack: 'Acknowledged', assign: 'Assigned', resolve: 'Resolved' };
const ACK_COLORS: Record<string, string> = {
  ack: 'bg-amber-400',
  assign: 'bg-sky-400',
  resolve: 'bg-emerald-400',
};

export default function EventDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const { data, refetch } = useIntelligenceEvent(id);
  const [actioning, setActioning] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const payload = data as { event?: FullEvent; acknowledgements?: Ack[]; context?: EventDetailContext };
  const ev = payload?.event;
  const acks: Ack[] = payload?.acknowledgements ?? [];
  const ctx: EventDetailContext = payload?.context ?? {};

  const sevCfg = ev ? (SEVERITY_CONFIG[ev.severity] ?? SEVERITY_CONFIG.Low) : SEVERITY_CONFIG.Low;
  const SevIcon = sevCfg.icon;

  async function postAction(action: 'ack' | 'assign' | 'resolve') {
    setActioning(action);
    try {
      await schoolFetch(`/api/intelligence-events/${id}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      setNote('');
      refetch();
    } finally {
      setActioning(null);
    }
  }

  if (!ev) {
    return (
      <SIPageShell
        title="Event detail"
        description="Loading event…"
        icon={<Loader2 className="h-5 w-5 animate-spin" />}
        tone="slate"
        parentCrumb={{ href: '/dashboard/school-intelligence/events', label: 'Events' }}
        currentCrumb="Loading…"
      >
        <p className="text-sm text-slate-500">Fetching event…</p>
      </SIPageShell>
    );
  }

  const ctxRows: Array<[string, string | undefined]> = [
    ['Rule', ctx.ruleName],
    ['Room', ctx.roomName],
    ['Zone', ctx.zoneName],
    ['Class', ctx.className],
    ['Section', ctx.sectionName],
    ['Subject', ctx.subjectName],
    ['Period', ctx.periodLabel],
    ['Time window', ctx.timeWindow],
    ['Calendar day', ctx.calendarDayType],
    ['Process owner', ctx.processOwner],
    ['Duty roster', ctx.dutyRosterRole],
    ['Camera purpose', ctx.cameraPurpose],
  ].filter(([, v]) => Boolean(v)) as Array<[string, string]>;

  return (
    <SIPageShell
      title={ev.eventType}
      description={ev.evidence.summary}
      icon={<SevIcon className="h-5 w-5" />}
      tone={ev.severity === 'Critical' || ev.severity === 'High' ? 'rose' : ev.severity === 'Medium' ? 'amber' : 'sky'}
      eyebrow={`${ev.module} module · severity ${ev.severity}`}
      parentCrumb={{ href: '/dashboard/school-intelligence/events', label: 'Events' }}
      currentCrumb={`Event #${ev.id}`}
      actions={
        <Link
          href="/dashboard/school-intelligence/events"
          className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-sky-500/30 hover:text-sky-200"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Events inbox
        </Link>
      }
    >
      {/* Hero status */}
      <SISection>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ring-1 ring-inset ${sevCfg.badge}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${sevCfg.dot}`} />
            {ev.severity}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ring-1 ring-inset ${STATUS_BADGE[ev.status] ?? STATUS_BADGE.Open}`}
          >
            {ev.status}
          </span>
          {ev.confidence != null && (
            <span className="rounded-md border border-slate-800 bg-slate-950/40 px-2 py-0.5 text-xs text-slate-400">
              {(ev.confidence * 100).toFixed(0)}% confidence
            </span>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            <span>Started:</span>
            <span className="text-slate-200">{new Date(ev.startedAt).toLocaleString()}</span>
          </div>
          {ev.endedAt && (
            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span>Ended:</span>
              <span className="text-slate-200">{new Date(ev.endedAt).toLocaleString()}</span>
            </div>
          )}
          {ev.cameraId != null && (
            <div className="flex items-center gap-1.5 text-slate-400">
              <Camera className="h-3.5 w-3.5 text-slate-500" />
              <span>Camera:</span>
              <span className="text-slate-200">#{ev.cameraId}</span>
            </div>
          )}
          {ev.zoneId != null && (
            <div className="flex items-center gap-1.5 text-slate-400">
              <span>Zone:</span>
              <span className="text-slate-200">#{ev.zoneId}</span>
            </div>
          )}
          {ev.roomId != null && (
            <div className="flex items-center gap-1.5 text-slate-400">
              <span>Room:</span>
              <span className="text-slate-200">#{ev.roomId}</span>
            </div>
          )}
          {ev.assignedTo && (
            <div className="flex items-center gap-1.5 text-slate-400">
              <User className="h-3.5 w-3.5 text-slate-500" />
              <span>Assigned:</span>
              <span className="text-slate-200">{ev.assignedTo}</span>
            </div>
          )}
        </div>
      </SISection>

      <div className="grid gap-5 lg:grid-cols-2">
        <SISection icon={<MapPin className="h-4 w-4" />} title="Location & context">
          {ctxRows.length === 0 ? (
            <p className="text-xs text-slate-500">No enriched context for this event (IDs or master data missing).</p>
          ) : (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
              {ctxRows.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 border-b border-slate-800/40 pb-1.5 last:border-0">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-right text-slate-200">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </SISection>

        {ev.evidence.metrics && Object.keys(ev.evidence.metrics).length > 0 && (
          <SISection icon={<FileText className="h-4 w-4" />} title="Evidence metrics">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {Object.entries(ev.evidence.metrics).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">{k.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">{String(v)}</p>
                </div>
              ))}
            </div>
            {ev.evidence.signalIds && ev.evidence.signalIds.length > 0 && (
              <p className="mt-3 text-xs text-slate-500">
                Signal IDs: <span className="text-slate-300">{ev.evidence.signalIds.join(', ')}</span>
              </p>
            )}
          </SISection>
        )}
      </div>

      {ev.cameraId != null && (
        <SISection title="Camera" description="Governance record for the camera linked to this event.">
          <Link
            href={`/dashboard/school-management/cameras/${ev.cameraId}`}
            className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950/40 px-2.5 py-1.5 text-xs font-medium text-sky-300 hover:border-sky-500/40 hover:text-sky-200"
          >
            Open camera detail <ArrowRight className="h-3 w-3" />
          </Link>
        </SISection>
      )}

      {ev.status !== 'Resolved' && (
        <SISection icon={<ShieldCheck className="h-4 w-4" />} title="Take action">
          <div className="space-y-3">
            <input
              placeholder="Optional note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-500/40 focus:outline-none focus:ring-2 focus:ring-sky-500/15"
            />
            <div className="flex flex-wrap gap-2">
              {ev.status === 'Open' && (
                <Button
                  size="sm"
                  className="bg-amber-500/90 text-slate-950 hover:bg-amber-400"
                  disabled={actioning === 'ack'}
                  onClick={() => postAction('ack')}
                >
                  {actioning === 'ack' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Acknowledge
                </Button>
              )}
              {(ev.status === 'Open' || ev.status === 'Acknowledged') && (
                <Button
                  size="sm"
                  className="bg-sky-500/90 text-white hover:bg-sky-400"
                  disabled={actioning === 'assign'}
                  onClick={() => postAction('assign')}
                >
                  {actioning === 'assign' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Assign
                </Button>
              )}
              <Button
                size="sm"
                className="bg-emerald-500/90 text-slate-950 hover:bg-emerald-400"
                disabled={actioning === 'resolve'}
                onClick={() => postAction('resolve')}
              >
                {actioning === 'resolve' ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                Resolve
              </Button>
            </div>
          </div>
        </SISection>
      )}

      {acks.length > 0 && (
        <SISection title="Activity timeline">
          <ol className="relative space-y-3 border-l border-slate-800/80 pl-5">
            {acks.map((a) => (
              <li key={a.id} className="relative">
                <span
                  className={`absolute -left-[26px] mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-slate-900 ${ACK_COLORS[a.action] ?? 'bg-slate-500'}`}
                />
                <p className="text-sm font-medium text-slate-200">{ACK_LABELS[a.action]}</p>
                {a.note && <p className="text-xs text-slate-400">{a.note}</p>}
                <p className="mt-0.5 text-xs text-slate-500">{new Date(a.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ol>
        </SISection>
      )}
    </SIPageShell>
  );
}
