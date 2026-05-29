'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  ShieldCheck,
  Users,
  LayoutGrid,
  HeartHandshake,
  CheckCircle2,
  Inbox,
  type LucideIcon,
} from 'lucide-react';

type NavLink = {
  href: string;
  label: string;
  description: string;
  phase: number;
  category: 'setup' | 'module' | 'tools';
  icon: LucideIcon;
};

const LINKS: NavLink[] = [
  { href: '/dashboard/school-intelligence/campus-safety', label: 'Campus Safety', description: 'Safety & security events', phase: 2, category: 'module', icon: ShieldCheck },
  { href: '/dashboard/school-intelligence/teacher-productivity', label: 'Teacher & Staff Management', description: 'Classroom activity, presence, timetable', phase: 2, category: 'module', icon: Users },
  { href: '/dashboard/school-intelligence/space-utilization', label: 'Space Utilization', description: 'Room usage efficiency', phase: 3, category: 'module', icon: LayoutGrid },
  { href: '/dashboard/school-intelligence/parent-experience', label: 'Parent Experience', description: 'Gate flow & dispersal', phase: 2, category: 'module', icon: HeartHandshake },
  { href: '/dashboard/school-intelligence/compliance', label: 'Compliance', description: 'Violations rollup', phase: 2, category: 'module', icon: CheckCircle2 },

  { href: '/dashboard/school-intelligence/events', label: 'Events Inbox', description: 'Rule engine events', phase: 3, category: 'tools', icon: Inbox },
];

const CATEGORY_META: Record<NavLink['category'], { label: string; description: string }> = {
  setup: { label: 'Foundation', description: 'Configure once' },
  module: { label: 'Intelligence Modules', description: 'Daily insights per area' },
  tools: { label: 'Scoring & Tools', description: 'Composite views and configuration' },
};

const PHASE_BADGE: Record<number, string> = {
  1: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
  2: 'bg-sky-500/10 text-sky-300 ring-sky-500/30',
  3: 'bg-indigo-500/10 text-indigo-300 ring-indigo-500/30',
  5: 'bg-violet-500/10 text-violet-300 ring-violet-500/30',
  6: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
};

function LinkTile({ link }: { link: NavLink }) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      className="group relative flex items-start gap-3 overflow-hidden rounded-xl border border-slate-800/70 bg-slate-900/50 p-3 transition-all hover:border-slate-700 hover:bg-slate-900/80 hover:shadow-lg hover:shadow-sky-950/30"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800/70 text-slate-300 ring-1 ring-inset ring-slate-700/60 transition-colors group-hover:bg-sky-500/10 group-hover:text-sky-300 group-hover:ring-sky-500/30">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-slate-100">{link.label}</p>
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ring-1 ring-inset ${PHASE_BADGE[link.phase] ?? PHASE_BADGE[2]}`}>
            P{link.phase}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">{link.description}</p>
      </div>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-600 transition-colors group-hover:text-sky-400" />
    </Link>
  );
}

export function SIQuickLinks() {
  const grouped: Record<NavLink['category'], NavLink[]> = { setup: [], module: [], tools: [] };
  LINKS.forEach((l) => grouped[l.category].push(l));

  return (
    <section className="space-y-5">
      {(['setup', 'module', 'tools'] as const)
        .filter((cat) => grouped[cat].length > 0)
        .map((cat) => (
        <div key={cat}>
          <div className="mb-2.5 flex items-baseline justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              {CATEGORY_META[cat].label}
            </h3>
            <p className="text-xs text-slate-600">{CATEGORY_META[cat].description}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {grouped[cat].map((l) => (
              <LinkTile key={l.href} link={l} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
