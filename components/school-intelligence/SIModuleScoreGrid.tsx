'use client';

import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { SIModuleScoreCard } from '@/components/school-intelligence/SIModuleScoreCard';
import { MODULE_LABELS } from '@/lib/school-score-engine/weights';
import type { ModuleScoreCompare } from '@/lib/school-intelligence/module-score-demo';
import type { DailyOverallScore, ModuleScore, ScoreModuleKey } from '@/lib/school-score-engine/types';
import { MODULE_PAGE_HREFS } from '@/lib/school-intelligence/module-routes';
import { buildFactsByScoreModule, moduleInsightBullets } from '@/lib/school-intelligence/module-score-insights';

type DailyOverview = {
  modules: { module: string; facts: { text: string }[] }[];
};

type ModuleRow = { key: string; mod: ScoreModuleKey };

type Props = {
  modules: ModuleRow[];
  scores: DailyOverallScore | null;
  dailyOverview: DailyOverview | null;
  date: string;
  compareLabel?: string;
  moduleCompare?: ModuleScoreCompare[];
  loading?: boolean;
  mvp3Only?: boolean;
  deferredLabels?: string[];
};

export function SIModuleScoreGrid({
  modules,
  scores,
  dailyOverview,
  date,
  compareLabel,
  moduleCompare = [],
  loading,
  mvp3Only,
  deferredLabels = [],
}: Props) {
  const factsByScore = useMemo(
    () => buildFactsByScoreModule(dailyOverview?.modules ?? []),
    [dailyOverview],
  );

  const scoreByMod = useMemo(() => {
    const map = new Map<ScoreModuleKey, ModuleScore>();
    for (const m of scores?.moduleScores ?? []) {
      map.set(m.moduleKey, m);
    }
    return map;
  }, [scores]);

  const compareByMod = useMemo(() => {
    const map = new Map<ScoreModuleKey, ModuleScoreCompare>();
    for (const m of moduleCompare) {
      map.set(m.moduleKey, m);
    }
    return map;
  }, [moduleCompare]);

  return (
    <div>
      {loading ? (
        <p className="flex items-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading module scores…
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {modules.map((kpi) => {
            const mod = kpi.mod;
            const row = scoreByMod.get(mod);
            const cmp = compareByMod.get(mod);
            const weight = scores?.weights?.[mod];
            const bullets = moduleInsightBullets(mod, row, factsByScore);
            return (
              <SIModuleScoreCard
                key={kpi.key}
                moduleKey={mod}
                label={MODULE_LABELS[mod] ?? kpi.key}
                score={cmp?.current ?? row?.score ?? null}
                previousScore={cmp?.prior ?? null}
                scoreDelta={cmp?.delta ?? null}
                compareLabel={compareLabel}
                weightPercent={weight != null ? Math.round(weight * 100) : undefined}
                bullets={bullets}
                href={MODULE_PAGE_HREFS[mod]}
                date={date}
              />
            );
          })}
        </div>
      )}

      {mvp3Only && deferredLabels.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          More scores coming: {deferredLabels.join(', ')} — enable full platform when ready.
        </p>
      )}
    </div>
  );
}
