'use client';

import Link from 'next/link';
import { GraduationCap, ArrowRight } from 'lucide-react';

export function SISchoolContextBanner() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-500/15 bg-gradient-to-r from-sky-500/10 via-indigo-500/5 to-violet-500/10 px-4 py-3 text-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/30">
          <GraduationCap className="h-4 w-4" />
        </div>
        <div>
          <p className="font-medium text-slate-100">School Intelligence preview</p>
          <p className="text-xs text-slate-400">
            Scores and facts use labeled demo data until live cameras and connectors are wired up.
          </p>
        </div>
      </div>
      <Link
        href="/dashboard/school-intelligence/master-data"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-200 transition-colors hover:bg-sky-500/20"
      >
        Setup checklist <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
