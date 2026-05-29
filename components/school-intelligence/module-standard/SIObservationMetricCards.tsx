'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { SIMetricCard } from '@/lib/school-intelligence/module-standard/types';

const TONE_BORDER: Record<NonNullable<SIMetricCard['tone']>, string> = {
  default: 'border-slate-800 bg-slate-900/50',
  warn: 'border-orange-900/40 bg-orange-950/10',
  critical: 'border-red-900/50 bg-red-950/20',
};

const TONE_VALUE: Record<NonNullable<SIMetricCard['tone']>, string> = {
  default: 'text-slate-200',
  warn: 'text-orange-300',
  critical: 'text-red-300',
};

type Props = {
  cards: SIMetricCard[];
};

export function SIObservationMetricCards({ cards }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => {
        const tone = card.tone ?? 'default';
        return (
          <Card key={card.label} className={`border ${TONE_BORDER[tone]}`}>
            <CardContent className="p-3">
              <p className="text-xs text-slate-500">{card.label}</p>
              <p className={`text-2xl font-bold tabular-nums ${TONE_VALUE[tone]}`}>{card.value}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
