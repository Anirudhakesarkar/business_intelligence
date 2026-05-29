'use client';

import { RefreshCw } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getPageHeaderForPath, pageHeaderToneClass } from '@/lib/layout/page-header-routes';
import { usePageHeaderRefreshAction } from './page-header-context';

export function HeaderPageTitle() {
  const pathname = usePathname();
  const config = getPageHeaderForPath(pathname);
  const onRefresh = usePageHeaderRefreshAction();

  if (!config) return null;

  const { title, tone, Icon } = config;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset sm:h-10 sm:w-10 sm:rounded-xl ${pageHeaderToneClass(tone)}`}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
        </div>
        <h1 className="truncate text-base font-semibold tracking-tight text-slate-50 sm:text-lg">
          {title}
        </h1>
      </div>
      {onRefresh && (
        <Button
          variant="outline"
          size="sm"
          className="ml-auto shrink-0 border-slate-700 text-slate-300 hover:border-sky-600"
          onClick={onRefresh}
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          Refresh
        </Button>
      )}
    </div>
  );
}
