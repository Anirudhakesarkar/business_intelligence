'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';

const LG_BREAKPOINT = 1024;

function useIsLg() {
  const [isLg, setIsLg] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`);
    const update = () => setIsLg(mql.matches);
    update();
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', update);
      return () => mql.removeEventListener('change', update);
    }
    // Safari/Electron variants can still expose addListener/removeListener.
    mql.addListener(update);
    return () => mql.removeListener(update);
  }, []);

  return isLg;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const isLg = useIsLg();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const showDrawer = !isLg;
  const mainPadding = isLg ? 'pl-64' : 'pl-0';

  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar
        open={showDrawer ? sidebarOpen : true}
        onClose={showDrawer ? () => setSidebarOpen(false) : undefined}
        showAsDrawer={showDrawer}
      />
      <div className={`flex h-screen min-w-0 flex-col overflow-x-hidden ${mainPadding}`}>
        <Header onMenuClick={showDrawer ? () => setSidebarOpen(true) : undefined} />
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 pb-10 sm:p-6 sm:pb-12">
          {children}
        </main>
      </div>
    </div>
  );
}
