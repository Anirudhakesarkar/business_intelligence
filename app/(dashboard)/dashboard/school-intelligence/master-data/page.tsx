'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  Circle,
  AlertCircle,
  ArrowRight,
  Camera,
  Building,
  CalendarDays,
  GraduationCap,
  Users,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { SIPageShell } from '@/components/school-intelligence/SIPageShell';
import { SISection } from '@/components/school-intelligence/SISection';
import { SIKPICard } from '@/components/school-intelligence/SIKPICard';

type SetupHealth = {
  completionPercent: number;
  camerasMapped: { complete: number; total: number };
  roomsConfigured: { complete: number; total: number };
  timetableEntries: number;
  rosterEntries: number;
  calendarDays: number;
  isReadyForPhase2: boolean;
  missing: string[];
};

type StaticItem = {
  label: string;
  why: string;
  href: string;
  /** Returns true if this item appears satisfied based on setup-health. */
  isDone?: (h: SetupHealth) => boolean;
  /** Returns optional progress text like "12 / 35". */
  progress?: (h: SetupHealth) => string | undefined;
};

const PHASE1_SETUP: StaticItem[] = [
  {
    label: 'Organization profile',
    why: 'School type, branches, operating goals',
    href: '/dashboard/school-management/organizations',
  },
  {
    label: 'Site profile',
    why: 'Campus, building, floor layout',
    href: '/dashboard/school-management/sites',
  },
  {
    label: 'Camera purpose mapping',
    why: 'Which camera watches what process',
    href: '/dashboard/school-management/cameras',
    isDone: (h) => h.camerasMapped.total > 0 && h.camerasMapped.complete === h.camerasMapped.total,
    progress: (h) => h.camerasMapped.total > 0 ? `${h.camerasMapped.complete} / ${h.camerasMapped.total}` : undefined,
  },
  {
    label: 'Room capacity',
    why: 'Required for occupancy scoring',
    href: '/dashboard/school-management/rooms',
    isDone: (h) => h.roomsConfigured.total > 0 && h.roomsConfigured.complete === h.roomsConfigured.total,
    progress: (h) => h.roomsConfigured.total > 0 ? `${h.roomsConfigured.complete} / ${h.roomsConfigured.total}` : undefined,
  },
  {
    label: 'School calendar',
    why: 'Working days, holidays, exam days',
    href: '/dashboard/school-management/calendar',
    isDone: (h) => h.calendarDays >= 30,
    progress: (h) => `${h.calendarDays} days configured`,
  },
  {
    label: 'Timetable',
    why: 'Expected class, subject, teacher, room per period',
    href: '/dashboard/school-management/timetable',
    isDone: (h) => h.timetableEntries > 0,
    progress: (h) => h.timetableEntries > 0 ? `${h.timetableEntries} entries` : undefined,
  },
  {
    label: 'Staff duty roster',
    why: 'Guard, coordinator, supervisor duty windows',
    href: '/dashboard/school-management/staff-duty',
    isDone: (h) => h.rosterEntries > 0,
    progress: (h) => h.rosterEntries > 0 ? `${h.rosterEntries} entries` : undefined,
  },
];

const PHASE2_SETUP: StaticItem[] = [
  { label: 'Teacher schedule mapping', why: 'Which teacher is expected when and where', href: '/dashboard/school-management/timetable' },
  { label: 'Break / lunch / dispersal timing', why: 'Context for discipline and parent experience', href: '/dashboard/school-management/settings' },
  { label: 'Risk zone definitions', why: 'Stairs, gate, lab, server room, playground', href: '/dashboard/school-management/cameras' },
  { label: 'Compliance & safety waivers', why: 'Playground waivers, supervised-only zones', href: '/dashboard/school-management/settings' },
];

function SetupRow({ item, health, phase2 }: { item: StaticItem; health?: SetupHealth | null; phase2?: boolean }) {
  const done = health && item.isDone ? item.isDone(health) : false;
  const progress = health && item.progress ? item.progress(health) : undefined;
  const dim = phase2 && health && !health.isReadyForPhase2;

  return (
    <Link
      href={item.href}
      className={`group flex items-start gap-3 rounded-xl border px-4 py-3 transition-all
        ${done ? 'border-emerald-500/25 bg-emerald-500/[0.04]' : 'border-slate-800/80 bg-slate-950/30'}
        ${dim ? 'opacity-60' : 'hover:border-slate-700 hover:bg-slate-900/50'}
      `}
    >
      {done ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-100">{item.label}</p>
        <p className="mt-0.5 text-xs text-slate-500">{item.why}</p>
        {progress && <p className="mt-1 text-[11px] font-medium text-slate-400">{progress}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${
            done
              ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30'
              : 'bg-slate-800 text-slate-400 ring-slate-700'
          }`}
        >
          {done ? 'Done' : phase2 ? 'Next' : 'Pending'}
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-slate-600 transition-colors group-hover:text-sky-400" />
      </div>
    </Link>
  );
}

const PURPOSE_MAP = [
  { cam: 'Main Gate', purpose: 'Arrival & Dispersal', module: 'Parent Experience', icon: Building },
  { cam: 'Classroom', purpose: 'Teacher / Student Presence', module: 'Academic Operations', icon: GraduationCap },
  { cam: 'Corridor', purpose: 'Movement & Discipline', module: 'Discipline', icon: Users },
  { cam: 'Playground', purpose: 'Break-time Safety', module: 'Occupancy', icon: Sparkles },
  { cam: 'Lab', purpose: 'Supervision & Compliance', module: 'Compliance', icon: CheckCircle2 },
  { cam: 'Server Room', purpose: 'Restricted Access', module: 'Security', icon: Camera },
];

export default function MasterDataPage() {
  const [health, setHealth] = useState<SetupHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/school-management/setup-health?organizationId=1');
        if (!res.ok) return;
        const data = (await res.json()) as SetupHealth;
        if (!cancelled) setHealth(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const phase1Done = PHASE1_SETUP.filter((i) => health && i.isDone && i.isDone(health)).length;
  const phase1Total = PHASE1_SETUP.length;
  const percent = health?.completionPercent ?? 0;

  return (
    <SIPageShell
      title="Master Data Setup"
      description="Foundation data that gives school context to every AI detection. Complete Phase 1 before enabling intelligence modules."
      icon={<ClipboardCheck className="h-6 w-6" />}
      tone="emerald"
      eyebrow="Phase 1 · Foundation"
      currentCrumb="Master Data Setup"
      actions={
        <Link
          href="/dashboard/school-management"
          className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-sky-500/30 hover:text-sky-200"
        >
          School management <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      {loading && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading setup health…
        </p>
      )}

      {/* Hero progress */}
      <SISection eyebrow="Setup health" title={`${percent}% complete`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SIKPICard
            label="Cameras mapped"
            value={health ? `${health.camerasMapped.complete}/${health.camerasMapped.total || 0}` : '—'}
            hint="Active cameras tagged"
            icon={<Camera className="h-3.5 w-3.5" />}
            tone={health && health.camerasMapped.total > 0 && health.camerasMapped.complete === health.camerasMapped.total ? 'success' : 'warning'}
          />
          <SIKPICard
            label="Rooms with capacity"
            value={health ? `${health.roomsConfigured.complete}/${health.roomsConfigured.total || 0}` : '—'}
            hint="Capacity required"
            icon={<Building className="h-3.5 w-3.5" />}
            tone={health && health.roomsConfigured.total > 0 && health.roomsConfigured.complete === health.roomsConfigured.total ? 'success' : 'warning'}
          />
          <SIKPICard
            label="Timetable entries"
            value={health?.timetableEntries ?? '—'}
            hint="Active class periods"
            icon={<CalendarDays className="h-3.5 w-3.5" />}
            tone={health && health.timetableEntries > 0 ? 'success' : 'warning'}
          />
          <SIKPICard
            label="Calendar days"
            value={health?.calendarDays ?? '—'}
            hint="Needs ≥ 30"
            icon={<CalendarDays className="h-3.5 w-3.5" />}
            tone={health && health.calendarDays >= 30 ? 'success' : 'warning'}
          />
        </div>

        {/* Progress bar */}
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800/80">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-sky-500 to-violet-500 transition-all duration-700"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-slate-400">{phase1Done} of {phase1Total} Phase 1 items complete</span>
          <span className={`font-medium ${health?.isReadyForPhase2 ? 'text-emerald-300' : 'text-amber-300'}`}>
            {health?.isReadyForPhase2 ? 'Ready for Phase 2 ✓' : 'Complete Phase 1 first'}
          </span>
        </div>
      </SISection>

      {/* Issues callout */}
      {health && health.missing.length > 0 && (
        <SISection icon={<AlertCircle className="h-4 w-4 text-amber-400" />} eyebrow="Outstanding" title={`${health.missing.length} item${health.missing.length === 1 ? '' : 's'} need attention`}>
          <ul className="space-y-1.5 text-sm">
            {health.missing.map((m) => (
              <li key={m} className="flex items-start gap-2 rounded-lg border border-amber-500/15 bg-amber-500/[0.04] px-3 py-2 text-amber-100">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                {m}
              </li>
            ))}
          </ul>
        </SISection>
      )}

      <SISection eyebrow="Phase 1 · Foundation" title="Setup checklist">
        <div className="space-y-2">
          {PHASE1_SETUP.map((item) => (
            <SetupRow key={item.label} item={item} health={health} />
          ))}
        </div>
      </SISection>

      <SISection eyebrow="Phase 2 · Expansion" title="Intelligence inputs" description="Unlock these after Phase 1 is complete.">
        <div className="space-y-2">
          {PHASE2_SETUP.map((item) => (
            <SetupRow key={item.label} item={item} health={health} phase2 />
          ))}
        </div>
      </SISection>

      <SISection
        icon={<Camera className="h-4 w-4" />}
        eyebrow="Mapping reference"
        title="Camera purpose mapping"
        description="Every camera must be mapped to a business purpose. Without this, the system can only report what it saw — not why it matters."
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {PURPOSE_MAP.map((row) => {
            const Icon = row.icon;
            return (
              <div
                key={row.cam}
                className="rounded-xl border border-slate-800/80 bg-slate-950/30 p-3 transition-colors hover:border-slate-700"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800/60 text-slate-300">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-sm font-medium text-slate-100">{row.cam}</p>
                </div>
                <p className="mt-2 text-xs text-slate-400">{row.purpose}</p>
                <p className="mt-1 text-xs font-medium text-sky-400">→ {row.module}</p>
              </div>
            );
          })}
        </div>
      </SISection>
    </SIPageShell>
  );
}
