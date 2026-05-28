'use client';

import { createContext, useContext } from 'react';

/** Default matches legacy `/dashboard/admin/*` routes when no provider is mounted. */
export const DEFAULT_ADMIN_BASE_PATH = '/dashboard/admin';

const AdminBasePathContext = createContext<string>(DEFAULT_ADMIN_BASE_PATH);

export function AdminBasePathProvider({
  basePath,
  children,
}: {
  basePath: string;
  children: React.ReactNode;
}) {
  return <AdminBasePathContext.Provider value={basePath}>{children}</AdminBasePathContext.Provider>;
}

export function useAdminBasePath(): string {
  return useContext(AdminBasePathContext);
}
