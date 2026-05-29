import type { SIObservation, SIStandardModuleConfig } from '@/lib/school-intelligence/module-standard/types';

const SCORE_BAND_INSIGHTS: { max: number; tips: string[] }[] = [
  {
    max: 55,
    tips: [
      'Observation volume is weighing on the module score — review the highest-severity patterns first.',
      'Repeat detections in the same zone often indicate a coverage or process gap worth a walk-through.',
    ],
  },
  {
    max: 70,
    tips: [
      'Medium-severity observations are accumulating — look for repeat types across the selected period.',
      'Tuning rule sensitivity during low-risk windows may reduce noise without losing important signals.',
    ],
  },
  {
    max: 85,
    tips: [
      'The observation mix is manageable — continue monitoring peak arrival, dismissal, and transition windows.',
      'Stable scores often depend on consistent coverage during the busiest campus periods.',
    ],
  },
  {
    max: 101,
    tips: ['Scores are strong for this period — use the feed to spot early drift before patterns worsen.'],
  },
];

export function buildModuleObservationInsights(
  score: number | null,
  observations: SIObservation[],
  config: SIStandardModuleConfig,
  minCount = 4,
): string[] {
  const tips: string[] = [];
  const push = (text: string) => {
    const t = text.trim();
    if (!t || tips.includes(t)) return;
    tips.push(t);
  };

  const priority = observations.filter(
    (o) => o.severity === 'Critical' || o.severity === 'High',
  );

  for (const o of priority.slice(0, 3)) {
    push(`${o.label}: ${o.summary}`);
    if (tips.length >= minCount) return tips.slice(0, minCount);
  }

  if (observations.length > 0) {
    push(
      `${observations.length} ${config.breadcrumb.toLowerCase()} observation${observations.length === 1 ? '' : 's'} in this period — for awareness, not alert closure.`,
    );
  }

  const band = SCORE_BAND_INSIGHTS.find((b) => (score ?? 0) < b.max);
  for (const line of band?.tips ?? SCORE_BAND_INSIGHTS[0].tips) {
    push(line);
    if (tips.length >= minCount) break;
  }

  return tips.slice(0, minCount);
}
