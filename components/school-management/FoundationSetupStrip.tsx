'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SetupProgressBar } from './SetupProgressBar';
import { useSetupHealth } from './useSchoolFoundation';

/** Foundation progress + next action — shown below each page title. */
export function FoundationSetupStrip() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data } = useSetupHealth();
  const percent = mounted ? (data?.completionPercent ?? 0) : 0;
  const next = mounted ? data?.nextAction : null;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3">
      <SetupProgressBar percent={percent} />
      <p className={`mt-2 text-xs text-slate-400 ${next ? '' : 'sr-only'}`}>
        {next ? (
          <>
            Next:{' '}
            <Link href={next.href} className="font-medium text-sky-400 hover:underline">
              {next.label}
            </Link>
            <span className="text-slate-500"> — {next.reason}</span>
          </>
        ) : (
          'Setup progress'
        )}
      </p>
    </div>
  );
}
