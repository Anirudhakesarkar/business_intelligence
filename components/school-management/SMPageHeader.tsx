'use client';
import { ReactNode } from 'react';
import { FoundationSetupStrip } from './FoundationSetupStrip';

export function SMPageHeader({
  title,
  subtitle,
  action,
  showFoundationProgress = true,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  /** When true, renders the foundation setup bar directly under this header. */
  showFoundationProgress?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
          <p className="text-sm text-slate-400">{subtitle}</p>
        </div>
        {action}
      </div>
      {showFoundationProgress && <FoundationSetupStrip />}
    </div>
  );
}
