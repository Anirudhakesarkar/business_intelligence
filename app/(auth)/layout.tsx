export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen min-w-0 bg-slate-950 flex items-center justify-center p-4">
      {children}
    </div>
  );
}
