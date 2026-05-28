'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { schoolFetch } from '@/lib/school-auth/client-fetch';

const CONFIRM_TOKEN = 'REMOVE_ACCEPTANCE_RESIDUE';

type ResidueCounts = {
  cameras: number;
  inactiveTimetable: number;
  inactiveRosters: number;
  acceptanceCalendars: number;
  total: number;
};

export function AcceptanceResiduePanel() {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const preview = useQuery({
    queryKey: ['sm-acceptance-residue-preview'],
    queryFn: async () => {
      const res = await schoolFetch('/api/school-management/acceptance-residue?organizationId=1');
      if (!res.ok) throw new Error('Preview failed');
      return res.json() as Promise<{ counts: ResidueCounts }>;
    },
  });

  const cleanup = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const res = await schoolFetch('/api/school-management/acceptance-residue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: 1,
          dryRun,
          ...(dryRun ? {} : { confirm: CONFIRM_TOKEN }),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? 'Cleanup failed');
      return body as { counts: ResidueCounts; deleted?: ResidueCounts; dryRun: boolean };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-'] });
      void qc.invalidateQueries({ queryKey: ['sm-setup-health'] });
      void qc.invalidateQueries({ queryKey: ['sm-acceptance-residue-preview'] });
      setConfirmOpen(false);
      setConfirmText('');
    },
  });

  const counts = preview.data?.counts;
  const total = counts?.total ?? 0;

  return (
    <Card className="border-amber-700/40 bg-amber-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-amber-200">Acceptance test residue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-400">
        <p>
          Rows from <span className="font-mono text-slate-300">accept:school-management:strict</span> that are not
          tagged in <span className="font-mono text-slate-300">school_demo_entity_tags</span>. Demo cleanup will not
          remove them. Cameras match <span className="font-mono">*accept*</span> codes; timetable/roster rows are
          hard-deleted only when <span className="font-mono">is_active=false</span>.
        </p>
        {preview.isLoading && <p className="text-xs text-slate-500">Counting residue rows…</p>}
        {counts && (
          <ul className="text-xs text-slate-300 space-y-1">
            <li>
              <span className="font-medium text-amber-300">{counts.cameras}</span> camera(s) (acceptance codes)
            </li>
            <li>
              <span className="font-medium text-amber-300">{counts.inactiveTimetable}</span> inactive timetable row(s)
            </li>
            <li>
              <span className="font-medium text-amber-300">{counts.inactiveRosters}</span> inactive staff-duty row(s)
            </li>
            <li>
              <span className="font-medium text-amber-300">{counts.acceptanceCalendars}</span> acceptance calendar
              label(s)
            </li>
            <li className="text-slate-500 pt-1">Total removable: {total}</li>
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={cleanup.isPending}
            onClick={() => cleanup.mutate(true)}
          >
            Refresh counts
          </Button>
          {total > 0 && !confirmOpen && (
            <Button size="sm" variant="destructive" onClick={() => setConfirmOpen(true)}>
              Remove residue…
            </Button>
          )}
        </div>
        {confirmOpen && (
          <div className="space-y-2 rounded-lg border border-amber-700/50 bg-slate-950/60 p-3">
            <p className="text-xs text-amber-200">
              Type <span className="font-mono">{CONFIRM_TOKEN}</span> to permanently delete {total} row(s) from
              Postgres.
            </p>
            <input
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_TOKEN}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={confirmText !== CONFIRM_TOKEN || cleanup.isPending}
                onClick={() => cleanup.mutate(false)}
              >
                {cleanup.isPending ? 'Removing…' : 'Confirm remove'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
