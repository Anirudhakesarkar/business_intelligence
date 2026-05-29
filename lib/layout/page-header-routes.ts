import type { ComponentType } from 'react';
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  DoorOpen,
  GraduationCap,
  Inbox,
  LayoutGrid,
  ListChecks,
  ScanEye,
  Scale,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  UserCheck,
  Users,
  UsersRound,
} from 'lucide-react';

export type PageHeaderTone = 'sky' | 'indigo' | 'violet' | 'emerald' | 'amber' | 'rose' | 'slate';

export type PageHeaderRouteConfig = {
  title: string;
  tone: PageHeaderTone;
  Icon: ComponentType<{ className?: string }>;
};

type RouteEntry = {
  prefix: string;
  exact?: boolean;
  /** Match only when pathname continues after prefix (e.g. event detail under /events/). */
  nestedOnly?: boolean;
  config: PageHeaderRouteConfig;
};

const TONE_TILE: Record<PageHeaderTone, string> = {
  sky: 'bg-gradient-to-br from-sky-500/30 via-sky-500/15 to-indigo-500/20 text-sky-300 ring-sky-500/30',
  indigo: 'bg-gradient-to-br from-indigo-500/30 via-indigo-500/15 to-violet-500/20 text-indigo-300 ring-indigo-500/30',
  violet: 'bg-gradient-to-br from-violet-500/30 via-violet-500/15 to-fuchsia-500/20 text-violet-300 ring-violet-500/30',
  emerald: 'bg-gradient-to-br from-emerald-500/30 via-emerald-500/15 to-teal-500/20 text-emerald-300 ring-emerald-500/30',
  amber: 'bg-gradient-to-br from-amber-500/30 via-amber-500/15 to-orange-500/20 text-amber-300 ring-amber-500/30',
  rose: 'bg-gradient-to-br from-rose-500/30 via-rose-500/15 to-red-500/20 text-rose-300 ring-rose-500/30',
  slate: 'bg-gradient-to-br from-slate-700/40 via-slate-700/20 to-slate-800/30 text-slate-300 ring-slate-700/40',
};

export function pageHeaderToneClass(tone: PageHeaderTone): string {
  return TONE_TILE[tone];
}

const SCHOOL_INTELLIGENCE_ROUTES: RouteEntry[] = [
  {
    prefix: '/dashboard/school-intelligence/vision-copilot',
    config: { title: 'Vision Copilot', tone: 'violet', Icon: ScanEye },
  },
  {
    prefix: '/dashboard/school-intelligence/campus-safety',
    config: { title: 'Campus Safety', tone: 'rose', Icon: ShieldAlert },
  },
  {
    prefix: '/dashboard/school-intelligence/teacher-productivity',
    config: { title: 'Teacher Productivity', tone: 'indigo', Icon: TrendingUp },
  },
  {
    prefix: '/dashboard/school-intelligence/teacher-supervision',
    config: { title: 'Teacher Supervision', tone: 'indigo', Icon: UserCheck },
  },
  {
    prefix: '/dashboard/school-intelligence/student-occupancy',
    config: { title: 'Student Occupancy', tone: 'sky', Icon: Users },
  },
  {
    prefix: '/dashboard/school-intelligence/academic-operations',
    config: { title: 'Academic Operations', tone: 'indigo', Icon: BookOpen },
  },
  {
    prefix: '/dashboard/school-intelligence/staff-deployment',
    config: { title: 'Staff Deployment', tone: 'violet', Icon: UsersRound },
  },
  {
    prefix: '/dashboard/school-intelligence/space-utilization',
    config: { title: 'Space Utilization', tone: 'emerald', Icon: LayoutGrid },
  },
  {
    prefix: '/dashboard/school-intelligence/gate-flow',
    config: { title: 'Gate Flow', tone: 'amber', Icon: DoorOpen },
  },
  {
    prefix: '/dashboard/school-intelligence/parent-experience',
    config: { title: 'Parent Experience', tone: 'emerald', Icon: Users },
  },
  {
    prefix: '/dashboard/school-intelligence/discipline',
    config: { title: 'Discipline', tone: 'rose', Icon: Scale },
  },
  {
    prefix: '/dashboard/school-intelligence/compliance',
    config: { title: 'Compliance', tone: 'amber', Icon: ClipboardCheck },
  },
  {
    prefix: '/dashboard/school-intelligence/zones-schedule',
    config: { title: 'Zones & Schedule', tone: 'sky', Icon: LayoutGrid },
  },
  {
    prefix: '/dashboard/school-intelligence/events/',
    nestedOnly: true,
    config: { title: 'Event Detail', tone: 'sky', Icon: Inbox },
  },
  {
    prefix: '/dashboard/school-intelligence/events',
    exact: true,
    config: { title: 'Events Inbox', tone: 'sky', Icon: Inbox },
  },
  {
    prefix: '/dashboard/school-intelligence/rules',
    config: { title: 'Intelligence Rules', tone: 'sky', Icon: ShieldCheck },
  },
  {
    prefix: '/dashboard/school-intelligence/actions',
    config: { title: 'Action Tasks', tone: 'violet', Icon: ListChecks },
  },
  {
    prefix: '/dashboard/school-intelligence/digest',
    config: { title: 'Daily Digest', tone: 'sky', Icon: CalendarDays },
  },
  {
    prefix: '/dashboard/school-intelligence/score-settings',
    config: { title: 'Score Settings', tone: 'slate', Icon: SlidersHorizontal },
  },
  {
    prefix: '/dashboard/school-intelligence/incidents',
    config: { title: 'Incidents', tone: 'rose', Icon: ShieldAlert },
  },
  {
    prefix: '/dashboard/school-intelligence/occupancy',
    config: { title: 'Occupancy', tone: 'sky', Icon: Users },
  },
  {
    prefix: '/dashboard/school-intelligence',
    exact: true,
    config: { title: 'School Intelligence', tone: 'sky', Icon: GraduationCap },
  },
];

function routeMatches(pathname: string, entry: RouteEntry): boolean {
  const { prefix, exact, nestedOnly } = entry;
  if (exact) return pathname === prefix;
  if (nestedOnly) {
    return pathname.startsWith(prefix) && pathname.length > prefix.length;
  }
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isSchoolIntelligencePath(pathname: string): boolean {
  return pathname === '/dashboard/school-intelligence' || pathname.startsWith('/dashboard/school-intelligence/');
}

/** Longest-prefix match for dashboard page titles shown in the sticky header. */
export function getPageHeaderForPath(pathname: string): PageHeaderRouteConfig | null {
  if (!isSchoolIntelligencePath(pathname)) return null;

  const match = SCHOOL_INTELLIGENCE_ROUTES.filter((entry) => routeMatches(pathname, entry)).sort(
    (a, b) => b.prefix.length - a.prefix.length
  )[0];

  return match?.config ?? null;
}
