'use client';

import Link from 'next/link';
import { ChevronRight, GraduationCap } from 'lucide-react';

type Crumb = { href: string; label: string };

type Props = {
  current: string;
  parent?: Crumb;
  /** Optional list of additional crumbs between root and current. */
  trail?: Crumb[];
};

export function SchoolIntelligenceBreadcrumbs({ current, parent, trail }: Props) {
  const crumbs: Crumb[] = [];
  if (parent) crumbs.push(parent);
  if (trail?.length) crumbs.push(...trail);

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-1 text-xs text-slate-500"
    >
      <Link
        href="/dashboard/school-intelligence"
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-medium text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-sky-300"
      >
        <GraduationCap className="h-3.5 w-3.5" />
        School Intelligence
      </Link>
      {crumbs.map((c) => (
        <span key={c.href} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-slate-600" />
          <Link
            href={c.href}
            className="rounded-md px-1.5 py-0.5 font-medium text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-sky-300"
          >
            {c.label}
          </Link>
        </span>
      ))}
      <ChevronRight className="h-3 w-3 text-slate-600" />
      <span className="px-1.5 py-0.5 font-medium text-slate-200">{current}</span>
    </nav>
  );
}
