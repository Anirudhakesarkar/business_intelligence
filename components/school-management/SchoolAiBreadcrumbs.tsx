'use client';

import Link from 'next/link';

const CRUMBS = [
  { href: '/dashboard/school-management', label: 'School Management' },
] as const;

export function SchoolAiBreadcrumbs({
  current,
  extra,
}: {
  current: string;
  extra?: { href: string; label: string };
}) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
      {CRUMBS.map((c) => (
        <span key={c.href} className="flex items-center gap-1">
          <Link href={c.href} className="text-sky-400 hover:underline">
            {c.label}
          </Link>
          <span>/</span>
        </span>
      ))}
      {extra && (
        <span className="flex items-center gap-1">
          <Link href={extra.href} className="text-sky-400 hover:underline">
            {extra.label}
          </Link>
          <span>/</span>
        </span>
      )}
      <span className="text-slate-300">{current}</span>
    </nav>
  );
}
