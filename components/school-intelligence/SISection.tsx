'use client';

import type { ReactNode } from 'react';

type Props = {
  title?: ReactNode;
  description?: ReactNode;
  /** Right-aligned actions in the header row. */
  actions?: ReactNode;
  /** Eyebrow / category label rendered above the title. */
  eyebrow?: ReactNode;
  /** Optional left icon. */
  icon?: ReactNode;
  children: ReactNode;
  /** Tighten padding for dense lists. */
  dense?: boolean;
  className?: string;
};

/**
 * Modern card primitive used across School Intelligence pages.
 * Replaces ad-hoc <Card> styling so every page inherits the same chrome.
 */
export function SISection({ title, description, actions, eyebrow, icon, children, dense, className }: Props) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm
        shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]
        ${className ?? ''}`}
    >
      {(title || actions || eyebrow) && (
        <header className={`flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/70 ${dense ? 'px-4 py-3' : 'px-5 py-4'}`}>
          <div className="flex min-w-0 items-start gap-2.5">
            {icon && <div className="mt-0.5 text-slate-400">{icon}</div>}
            <div className="min-w-0">
              {eyebrow && (
                <p className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  {eyebrow}
                </p>
              )}
              {title && <h2 className="truncate text-sm font-semibold text-slate-100">{title}</h2>}
              {description && <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={dense ? 'px-4 py-3' : 'px-5 py-5'}>{children}</div>
    </section>
  );
}
