'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Settings, LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/app/providers/auth-provider';
import { NotificationBell } from './notification-bell';
import { HeaderPageTitle } from './header-page-title';

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-slate-800 bg-slate-950/80 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
        {onMenuClick && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="shrink-0 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <HeaderPageTitle />
      </div>
      <div className="flex items-center gap-2">
        {user && (
          <span className="hidden items-center gap-1.5 text-sm sm:flex">
            <span className="text-slate-300">{user.display_name || user.email}</span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs capitalize text-slate-400">
              {user.role}
            </span>
          </span>
        )}
        <NotificationBell />
        <Link
          href="/dashboard/settings"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          aria-label="Settings"
        >
          <Settings className="h-5 w-5" />
        </Link>
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
