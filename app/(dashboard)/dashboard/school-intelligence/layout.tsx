import type { ReactNode } from 'react';

/**
 * Shared chrome for the entire School Intelligence module.
 * Adds a subtle ambient gradient backdrop so every page in the section
 * feels visually unified — actual page chrome (header, breadcrumb, filters)
 * is rendered by each page via SIPageShell.
 */
export default function SchoolIntelligenceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-full">
      {/* Ambient backdrop — pure decoration, doesn't capture clicks */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[360px] overflow-hidden"
      >
        <div className="absolute -top-32 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-sky-500/[0.07] blur-3xl" />
        <div className="absolute -top-16 left-1/4 h-[320px] w-[420px] rounded-full bg-indigo-500/[0.06] blur-3xl" />
        <div className="absolute -top-16 right-1/4 h-[320px] w-[420px] rounded-full bg-violet-500/[0.06] blur-3xl" />
      </div>
      <div className="px-1 pb-12">{children}</div>
    </div>
  );
}
