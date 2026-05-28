'use client';

import { useAuth } from '@/app/providers/auth-provider';
import type { AuthUser } from '@/lib/types';

type RoleGateProps = {
  /** Roles allowed to see the children */
  allowed: AuthUser['role'][];
  /** Rendered when user doesn't have the required role (defaults to nothing) */
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Conditionally renders children based on the current user's role.
 * If the user is not authenticated or doesn't have one of the allowed roles,
 * renders the fallback (or nothing).
 */
export function RoleGate({ allowed, fallback = null, children }: RoleGateProps) {
  const { hasRole } = useAuth();
  if (!hasRole(...allowed)) return <>{fallback}</>;
  return <>{children}</>;
}

type AccessDeniedProps = {
  message?: string;
};

/** Full-page "access denied" fallback for restricted pages */
export function AccessDenied({ message }: AccessDeniedProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <div className="rounded-full bg-red-500/10 p-4">
        <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-slate-200">Access Denied</h2>
      <p className="max-w-sm text-sm text-slate-400">
        {message || 'You don\'t have permission to view this page. Contact your administrator if you believe this is an error.'}
      </p>
    </div>
  );
}
