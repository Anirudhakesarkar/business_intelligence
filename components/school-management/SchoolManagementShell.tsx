'use client';

import Link from 'next/link';
import { SetupProgressBar } from './SetupProgressBar';
import { useSetupHealth } from './useSchoolFoundation';

export function SchoolManagementShell({ children }: { children: React.ReactNode }) {
  const { data } = useSetupHealth();
  const percent = data?.completionPercent ?? 0;
  const next = data?.nextAction;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3">
        <SetupProgressBar percent={percent} />
        {next && (
          <p className="mt-2 text-xs text-slate-400">
            Next:{' '}
            <Link href={next.href} className="font-medium text-sky-400 hover:underline">
              {next.label}
            </Link>
            <span className="text-slate-500"> — {next.reason}</span>
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
