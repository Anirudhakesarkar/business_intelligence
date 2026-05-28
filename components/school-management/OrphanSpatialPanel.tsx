'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { schoolFetch } from '@/lib/school-auth/client-fetch';

const CONFIRM_TOKEN = 'REMOVE_ORPHAN_SPATIAL';

type OrphanCounts = { orphanZones: number; orphanRooms: number; total: number };

export function OrphanSpatialPanel() {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const preview = useQuery({
    queryKey: ['sm-orphan-spatial-preview'],
    queryFn: async () => {
      const res = await schoolFetch('/api/school-management/orphan-spatial');
      if (!res.ok) throw new Error('Preview failed');
      return res.json() as Promise<{ counts: OrphanCounts }>;
    },
  });

  const cleanup = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const res = await schoolFetch('/api/school-management/orphan-spatial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun,
          ...(dryRun ? {} : { confirm: CONFIRM_TOKEN }),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? 'Cleanup failed');
      return body as { counts: OrphanCounts; deleted?: OrphanCounts; dryRun: boolean };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sm-'] });
      void qc.invalidateQueries({ queryKey: ['sm-setup-health'] });
      void qc.invalidateQueries({ queryKey: ['sm-orphan-spatial-preview'] });
      setConfirmOpen(false);
      setConfirmText('');
    },
  });

  const counts = preview.data?.counts;
  const total = counts?.total ?? 0;

  return (
    <Card className="border-slate-700 bg-slate-900/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-300">Orphan spatial rows</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-400">
        <p>
          Zones and rooms not linked through any campus hierarchy (often leftover demo imports). Setup-health ignores these; removing them aligns API zone counts with org-scoped data.
        </p>
        {preview.isLoading && <p className="text-xs text-slate-500">Counting orphan rows…</p>}
        {counts && (
          <p className="text-xs text-slate-300">
            <span className="font-medium text-amber-300">{total}</span> orphan row(s)
            {total > 0
              ? ` — ${counts.orphanZones} zone(s), ${counts.orphanRooms} room(s)`
              : ' — none detected'}
          </p>
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
              Remove orphan rows
            </Button>
          )}
        </div>
        {confirmOpen && (
          <div className="space-y-2 rounded border border-red-500/30 bg-red-500/5 p-3">
            <p className="text-xs text-red-300">
              Type <code className="text-red-200">{CONFIRM_TOKEN}</code> to permanently delete {total} orphan spatial row(s).
            </p>
            <input
              className="h-8 w-full rounded border border-slate-700 bg-slate-800 px-2 text-xs text-slate-100"
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
                {cleanup.isPending ? 'Removing…' : 'Confirm delete'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setConfirmOpen(false); setConfirmText(''); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        {cleanup.isSuccess && cleanup.data?.deleted && (
          <p className="text-xs text-green-400">
            Removed {cleanup.data.deleted.total} row(s) ({cleanup.data.deleted.orphanZones} zones, {cleanup.data.deleted.orphanRooms} rooms).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
