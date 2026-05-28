'use client';

import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  value: string;
  onChange: (next: string) => void;
  /** Show prev/next arrows that walk by one day. Default true. */
  showSteppers?: boolean;
  /** Optional max date string (ISO). Defaults to today. */
  max?: string;
  className?: string;
};

function shift(iso: string, deltaDays: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export function SIDatePicker({ value, onChange, showSteppers = true, max, className }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const upperBound = max ?? today;

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-slate-800 bg-slate-900/70 text-slate-200 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset] ${className ?? ''}`}
    >
      {showSteppers && (
        <button
          type="button"
          aria-label="Previous day"
          onClick={() => onChange(shift(value, -1))}
          className="rounded-l-lg px-2 py-1.5 text-slate-400 hover:bg-slate-800/80 hover:text-sky-300"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <label className="flex items-center gap-1.5 px-2 py-1 text-sm">
        <Calendar className="h-4 w-4 text-slate-500" />
        <input
          type="date"
          value={value}
          max={upperBound}
          onChange={(e) => onChange(e.target.value)}
          className="bg-transparent text-sm text-slate-100 focus:outline-none [color-scheme:dark]"
        />
      </label>
      {showSteppers && (
        <button
          type="button"
          aria-label="Next day"
          onClick={() => onChange(shift(value, 1))}
          disabled={value >= upperBound}
          className="rounded-r-lg px-2 py-1.5 text-slate-400 hover:bg-slate-800/80 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
