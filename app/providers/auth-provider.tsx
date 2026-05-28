'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { AuthUser, Config } from '@/lib/types';
import { getConfig, setConfig, clearConfig } from '@/app/lib/config';

type AuthContextValue = {
  user: AuthUser | null;
  role: AuthUser['role'] | null;
  token: string | null;
  config: Config | null;
  isAuthenticated: boolean;
  /** Check if user has one of the given roles */
  hasRole: (...roles: AuthUser['role'][]) => boolean;
  /** Check if user can access a specific site */
  canAccessSite: (siteId: string) => boolean;
  /** Update the active siteId (for superadmin switching sites) */
  setSiteId: (siteId: string) => void;
  /** Re-read auth from storage (call after login so dashboard sees new state) */
  refreshAuth: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [config, setConfigState] = useState<Config | null>(null);
  const [mounted, setMounted] = useState(false);

  const refreshAuth = useCallback(() => {
    setConfigState(getConfig());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cfg = getConfig();
      setConfigState(cfg);
      setMounted(true);

      if (cfg?.token && cfg?.user) return;
      if (cfg?.apiKey && !cfg.token) return;
      // Login has been removed from this project, so we don't attempt a session refresh.
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mounted) setConfigState(getConfig());
  }, [pathname, mounted]);

  const user = config?.user ?? null;
  const token = config?.token ?? null;
  const role = user?.role ?? null;
  const isAuthenticated = !!(token && user);

  const hasRole = useCallback(
    (...roles: AuthUser['role'][]) => {
      if (!role) return false;
      return roles.includes(role);
    },
    [role]
  );

  const canAccessSite = useCallback(
    (siteId: string) => {
      if (!user) return false;
      if (user.role === 'superadmin' || user.role === 'org_admin') return true;
      return user.site_ids.includes(siteId);
    },
    [user]
  );

  const setSiteId = useCallback(
    (siteId: string) => {
      if (!config) return;
      const updated = { ...config, siteId };
      setConfig(updated);
      setConfigState(updated);
    },
    [config]
  );

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* still clear local state */
    }
    clearConfig();
    setConfigState(null);
    router.push('/dashboard');
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, role, token, config, isAuthenticated, hasRole, canAccessSite, setSiteId, refreshAuth, logout }),
    [user, role, token, config, isAuthenticated, hasRole, canAccessSite, setSiteId, refreshAuth, logout]
  );

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500" />
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
