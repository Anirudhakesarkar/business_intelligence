'use client';

import Link from 'next/link';
import {
  AlertOctagon,
  ArrowUpRight,
  Building,
  CheckCircle2,
  GraduationCap,
  HeartHandshake,
  LayoutGrid,
  Minus,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ScoreModuleKey } from '@/lib/school-score-engine/types';
import { scoreDisplayStyle } from '@/lib/school-intelligence/module-score-insights';

const MODULE_ICONS: Record<ScoreModuleKey, LucideIcon> = {
  teacher: Users,
  occupancy: Building,
  academic: GraduationCap,
  staff: UserCog,
  space: LayoutGrid,
  discipline: AlertOctagon,
  parent: HeartHandshake,
  compliance: CheckCircle2,
  safety: ShieldCheck,
  security: ShieldCheck,
};

type Props = {
  moduleKey: ScoreModuleKey;
  label: string;
  score: number | null;
  previousScore?: number | null;
  scoreDelta?: number | null;
  compareLabel?: string;
  weightPercent?: number;
  bullets: string[];
  href: string;
  date: string;
};

export function SIModuleScoreCard({
  moduleKey,
  label,
  score,
  previousScore = null,
  scoreDelta = null,
  compareLabel,
  weightPercent,
  bullets,
  href,
  date,
}: Props) {
  const Icon = MODULE_ICONS[moduleKey];
  const style = scoreDisplayStyle(score);
  const displayScore = score != null ? score : '—';
  const progress = score != null ? Math.min(100, Math.max(0, score)) : 0;
  const DeltaIcon =
    scoreDelta != null && scoreDelta > 0
      ? TrendingUp
      : scoreDelta != null && scoreDelta < 0
        ? TrendingDown
        : Minus;
  const deltaTone =
    scoreDelta != null && scoreDelta > 0
      ? 'text-green-400'
      : scoreDelta != null && scoreDelta < 0
        ? 'text-red-400'
        : 'text-slate-500';

  return (
    <Link
      href={`${href}?date=${encodeURIComponent(date)}`}
      className={`group flex h-full flex-col rounded-2xl border p-5 transition-all
        ${style.border} ${style.bg}
        hover:border-slate-600 hover:shadow-lg hover:shadow-sky-950/25`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950/60 text-slate-300 ring-1 ring-inset ring-slate-700/80 transition-colors group-hover:bg-sky-500/10 group-hover:text-sky-300 group-hover:ring-sky-500/30">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">{label}</p>
            {weightPercent != null && weightPercent > 0 && (
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">
                Weight {weightPercent}%
              </p>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${style.badge}`}
        >
          {score == null ? 'No score' : score >= 85 ? 'Strong' : score >= 70 ? 'Good' : score >= 55 ? 'Watch' : 'At risk'}
        </span>
      </div>

      <div className="mt-4 space-y-1">
        {(previousScore != null || compareLabel) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {previousScore != null && (
              <span className="text-slate-500">
                Previous:{' '}
                <span className="tabular-nums font-medium text-slate-400">{previousScore}</span>
              </span>
            )}
            {compareLabel && <span className="text-slate-600">{compareLabel}</span>}
          </div>
        )}
        <div className="flex items-end gap-3">
          <p className={`text-4xl font-bold tabular-nums tracking-tight ${style.text}`}>{displayScore}</p>
          <p className="mb-1 text-sm text-slate-500">/ 100</p>
          {scoreDelta != null && scoreDelta !== 0 && (
            <span
              className={`mb-1 inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums ${deltaTone}`}
            >
              <DeltaIcon className="h-4 w-4 shrink-0" aria-hidden />
              {scoreDelta > 0 ? '+' : ''}
              {scoreDelta}
            </span>
          )}
          {score != null && (
          <div className="relative ml-auto flex h-14 w-14 shrink-0 items-center justify-center">
            <svg className="h-14 w-14 -rotate-90" viewBox="0 0 36 36" aria-hidden>
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#1e293b" strokeWidth="2.5" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke={style.ring}
                strokeWidth="2.5"
                strokeDasharray={`${progress * 0.974} 100`}
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}
        </div>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800/90">
        <div
          className={`h-full rounded-full transition-all ${style.bar}`}
          style={{ width: score != null ? `${progress}%` : '0%' }}
        />
      </div>

      <div className="mt-4 flex-1 border-t border-slate-800/80 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Key signals</p>
        <ul className="mt-2.5 space-y-2">
          {bullets.slice(0, 5).map((line, i) => (
            <li key={`${moduleKey}-${i}-${line.slice(0, 32)}`} className="flex gap-2 text-xs leading-relaxed text-slate-400">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sky-500/80" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-sky-400/90 transition-colors group-hover:text-sky-300">
        View module <ArrowUpRight className="h-3.5 w-3.5" />
      </p>
    </Link>
  );
}
