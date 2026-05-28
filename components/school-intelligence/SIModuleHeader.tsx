'use client';

import type { ReactNode } from 'react';

type Tone = 'sky' | 'indigo' | 'violet' | 'emerald' | 'amber' | 'rose' | 'slate';

type Props = {
  title: string;
  description?: string;
  icon?: ReactNode;
  /** Visual tone of the icon tile. Defaults to sky→indigo gradient. */
  tone?: Tone;
  /** Small label above the title (e.g. category, phase, breadcrumb). */
  eyebrow?: ReactNode;
  /** Optional right-aligned actions (buttons, filters, etc.). */
  actions?: ReactNode;
};

const TONE_TILE: Record<Tone, string> = {
  sky: 'bg-gradient-to-br from-sky-500/30 via-sky-500/15 to-indigo-500/20 text-sky-300 ring-sky-500/30',
  indigo: 'bg-gradient-to-br from-indigo-500/30 via-indigo-500/15 to-violet-500/20 text-indigo-300 ring-indigo-500/30',
  violet: 'bg-gradient-to-br from-violet-500/30 via-violet-500/15 to-fuchsia-500/20 text-violet-300 ring-violet-500/30',
  emerald: 'bg-gradient-to-br from-emerald-500/30 via-emerald-500/15 to-teal-500/20 text-emerald-300 ring-emerald-500/30',
  amber: 'bg-gradient-to-br from-amber-500/30 via-amber-500/15 to-orange-500/20 text-amber-300 ring-amber-500/30',
  rose: 'bg-gradient-to-br from-rose-500/30 via-rose-500/15 to-red-500/20 text-rose-300 ring-rose-500/30',
  slate: 'bg-gradient-to-br from-slate-700/40 via-slate-700/20 to-slate-800/30 text-slate-300 ring-slate-700/40',
};

export function SIModuleHeader({ title, description, icon, tone = 'sky', eyebrow, actions }: Props) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        {icon && (
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${TONE_TILE[tone]}`}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
              {eyebrow}
            </div>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-[1.6rem]">
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
