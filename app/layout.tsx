import './globals.css';
import type { Metadata } from 'next';
import { QueryProvider } from './providers/query-provider';
import { AuthProvider } from './providers/auth-provider';

export const metadata: Metadata = {
  title: 'Orion Alerts',
  description: 'Orion Alerts dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
