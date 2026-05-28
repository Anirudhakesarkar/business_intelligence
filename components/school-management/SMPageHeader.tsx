'use client';
import { ReactNode } from 'react';

export function SMPageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
        <p className="text-sm text-slate-400">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
