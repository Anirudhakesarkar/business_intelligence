'use client';

import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

type Tone = 'default' | 'success' | 'info' | 'warning' | 'danger';

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
  /** Optional small icon shown to the left of the label. */
  icon?: ReactNode;
  /** Optional delta vs prior period; positive numbers render as up, negative as down. */
  delta?: number | null;
  /** Optional direction override for the delta arrow. */
  deltaDirection?: 'up-good' | 'up-bad';
  /** Optional sparkline data — small inline trend. */
  sparkline?: number[];
  /** Render the card as a clickable element. */
  onClick?: () => void;
};

const TONE_VALUE: Record<Tone, string> = {
  default: 'text-slate-50',
  success: 'text-emerald-300',
  info: 'text-sky-300',
  warning: 'text-amber-300',
  danger: 'text-rose-300',
};

const TONE_ACCENT: Record<Tone, string> = {
  default: 'before:from-slate-500/60',
  success: 'before:from-emerald-500/70',
  info: 'before:from-sky-500/70',
  warning: 'before:from-amber-500/70',
  danger: 'before:from-rose-500/70',
};

function Sparkline({ data, tone = 'info' }: { data: number[]; tone?: Tone }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = Math.max(max - min, 1);
  const w = 80;
  const h = 22;
  const step = data.length > 1 ? w / (data.length - 1) : 0;
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(' ');
  const stroke =
    tone === 'success' ? '#34d399'
      : tone === 'warning' ? '#fbbf24'
      : tone === 'danger' ? '#fb7185'
      : tone === 'default' ? '#94a3b8'
      : '#7dd3fc';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SIKPICard({
  label,
  value,
  hint,
  tone = 'default',
  icon,
  delta,
  deltaDirection = 'up-good',
  sparkline,
  onClick,
}: Props) {
  const interactive = typeof onClick === 'function';
  const Tag = interactive ? 'button' : 'div';
  const deltaCls =
    delta == null || delta === 0
      ? 'text-slate-500'
      : (delta > 0 ? (deltaDirection === 'up-good' ? 'text-emerald-400' : 'text-rose-400')
                   : (deltaDirection === 'up-good' ? 'text-rose-400' : 'text-emerald-400'));
  const DeltaIcon = delta == null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <Tag
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/70 p-4 text-left backdrop-blur-sm transition-all
        before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:via-transparent before:to-transparent ${TONE_ACCENT[tone]}
        ${interactive ? 'cursor-pointer hover:border-slate-700 hover:bg-slate-900/90 hover:shadow-lg hover:shadow-sky-950/30' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-slate-400">
          {icon && <span className="text-slate-500">{icon}</span>}
          <span>{label}</span>
        </div>
        {sparkline && sparkline.length > 1 && <Sparkline data={sparkline} tone={tone} />}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className={`text-2xl font-semibold tracking-tight ${TONE_VALUE[tone]}`}>{value}</p>
        {delta != null && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${deltaCls}`}>
            <DeltaIcon className="h-3 w-3" />
            {delta > 0 ? '+' : ''}{delta}
          </span>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </Tag>
  );
}
