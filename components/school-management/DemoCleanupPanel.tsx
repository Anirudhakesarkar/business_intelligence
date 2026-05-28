'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { schoolFetch } from '@/lib/school-auth/client-fetch';

const ORG_ID = 1;
const CONFIRM_TOKEN = 'REMOVE_DEMO_DATA';

type DemoCounts = Record<string, number> & { total: number };

function formatCounts(counts: DemoCounts) {
  return Object.entries(counts)
    .filter(([k, v]) => k !== 'total' && v > 0)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
}

export function DemoCleanupPanel() {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const preview = useQuery({
    queryKey: ['sm-demo-cleanup-preview', ORG_ID],
    queryFn: async () => {
      const res = await schoolFetch(`/api/school-management/demo-cleanup?organizationId=${ORG_ID}`);
      if (!res.ok) throw new Error('Preview failed');
      return res.json() as Promise<{ counts: DemoCounts }>;
    },
  });

  const backfill = useMutation({
    mutationFn: async () => {
      const res = await schoolFetch('/api/school-management/demo-tag-backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: ORG_ID }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? 'Backfill failed');
      return body as { newlyTagged: number; after: DemoCounts };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-demo-cleanup-preview'] });
    },
  });

  const cleanup = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const res = await schoolFetch('/api/school-management/demo-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: ORG_ID,
          dryRun,
          ...(dryRun ? {} : { confirm: CONFIRM_TOKEN }),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? 'Cleanup failed');
      return body as { counts: DemoCounts; deleted?: DemoCounts; dryRun: boolean };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-'] });
      void qc.invalidateQueries({ queryKey: ['sm-setup-health'] });
      void qc.invalidateQueries({ queryKey: ['sm-demo-cleanup-preview'] });
      setConfirmOpen(false);
      setConfirmText('');
    },
  });

  const counts = preview.data?.counts;
  const total = counts?.total ?? 0;

  return (
    <Card className="border-slate-700 bg-slate-900/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-300">Demo data cleanup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-400">
        <p>
          Removes only rows tagged when demo seed last ran. Manually added records without demo tags are kept.
        </p>
        {preview.isLoading && <p className="text-xs text-slate-500">Loading tagged row counts…</p>}
        {preview.isError && (
          <p className="text-xs text-red-400">{(preview.error as Error).message}</p>
        )}
        {counts && (
          <p className="text-xs text-slate-300">
            <span className="font-medium text-amber-300">{total}</span> tagged row(s)
            {total > 0 ? ` — ${formatCounts(counts)}` : ' — nothing to remove'}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-slate-600"
            onClick={() => void preview.refetch()}
            disabled={preview.isFetching}
          >
            Refresh counts
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-slate-600"
            disabled={backfill.isPending}
            onClick={() => backfill.mutate()}
            title="Tag all current org foundation rows as demo (for DBs seeded before tags existed)"
          >
            {backfill.isPending ? 'Tagging…' : 'Tag current data as demo'}
          </Button>
          {total > 0 && !confirmOpen && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
            >
              Remove demo-tagged data…
            </Button>
          )}
        </div>
        {confirmOpen && (
          <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <p className="text-xs text-red-300">
              Type <code className="text-red-200">{CONFIRM_TOKEN}</code> to confirm removal of {total} tagged row(s).
            </p>
            <input
              className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100"
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
              <Button size="sm" variant="ghost" onClick={() => { setConfirmOpen(false); setConfirmText(''); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        {cleanup.isSuccess && !cleanup.data.dryRun && cleanup.data.deleted && (
          <p className="text-xs text-green-400">
            Removed {cleanup.data.deleted.total} demo-tagged row(s).
          </p>
        )}
        {cleanup.isError && (
          <p className="text-xs text-red-400">{(cleanup.error as Error).message}</p>
        )}
      </CardContent>
    </Card>
  );
}
