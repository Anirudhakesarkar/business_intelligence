'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { isSchoolIntelligencePath } from '@/lib/layout/page-header-routes';
import { SIModuleHeader } from './SIModuleHeader';
import { SchoolIntelligenceBreadcrumbs } from './SchoolIntelligenceBreadcrumbs';

type Tone = 'sky' | 'indigo' | 'violet' | 'emerald' | 'amber' | 'rose' | 'slate';

type Props = {
  title: string;
  description?: string;
  icon?: ReactNode;
  tone?: Tone;
  /** Page name shown as current crumb. Defaults to title. */
  currentCrumb?: string;
  /** Optional parent crumb between root and current. */
  parentCrumb?: { href: string; label: string };
  /** Top-right action area (buttons, date pickers, etc.). */
  actions?: ReactNode;
  /** Optional banner rendered above the header (alerts, MVP notice, etc.). */
  banner?: ReactNode;
  /** Optional small label rendered above the title. */
  eyebrow?: ReactNode;
  children: ReactNode;
};

/**
 * Unified page shell for every School Intelligence page.
 * Provides breadcrumb + module header + consistent vertical rhythm.
 */
export function SIPageShell({
  title,
  description,
  icon,
  tone = 'sky',
  currentCrumb,
  parentCrumb,
  actions,
  banner,
  eyebrow,
  children,
}: Props) {
  const pathname = usePathname();
  const useStickyHeader = isSchoolIntelligencePath(pathname);

  return (
    <div className="space-y-7">
      <div className="space-y-4">
        <SchoolIntelligenceBreadcrumbs current={currentCrumb ?? title} parent={parentCrumb} />
        {banner}
        {useStickyHeader ? (
          actions ? (
            <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
          ) : null
        ) : (
          <SIModuleHeader
            title={title}
            description={description}
            icon={icon}
            tone={tone}
            eyebrow={eyebrow}
            actions={actions}
          />
        )}
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  );
}
