'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { schoolFetch } from '@/lib/school-auth/client-fetch';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';

type AuditEntry = {
  id: number;
  actorId?: number;
  action: string;
  entityType: string;
  entityId?: number;
  createdAt: string;
};

type RulePayload = {
  rule: {
    id: number;
    name: string;
    eventType: string;
    cooldownSeconds: number;
    enabled: boolean;
    version: number;
  };
  conditions: Array<{ id: number; conditionType: string; parameters: Record<string, unknown>; sortOrder: number }>;
};

export function RuleEditSheet({
  ruleId,
  onClose,
}: {
  ruleId: number | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [cooldown, setCooldown] = useState(600);
  const [minMinutes, setMinMinutes] = useState(6);
  const [minStudents, setMinStudents] = useState(5);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['intel-rule-detail', ruleId],
    queryFn: async () => (await schoolFetch(`/api/intelligence-rules/${ruleId}`)).json(),
    enabled: ruleId != null && ruleId > 0,
  });

  const { data: auditData } = useQuery({
    queryKey: ['intel-rule-audit', ruleId],
    queryFn: async () => {
      const res = await schoolFetch('/api/school-management/audit-log?entityType=intelligence_rule&limit=80');
      if (!res.ok) return { entries: [] as AuditEntry[] };
      return (await res.json()) as { entries: AuditEntry[] };
    },
    enabled: ruleId != null && ruleId > 0,
  });

  const payload = data as RulePayload | undefined;
  const auditForRule = (auditData?.entries ?? [])
    .filter((e) => e.entityType === 'intelligence_rule' && e.entityId === ruleId)
    .slice(0, 12);

  useEffect(() => {
    if (!payload?.rule) return;
    setCooldown(payload.rule.cooldownSeconds);
    const c0 = payload.conditions[0];
    if (c0?.conditionType === 'no_teacher_with_students') {
      const p = c0.parameters as { minMinutes?: number; minStudents?: number };
      setMinMinutes(Number(p.minMinutes ?? 6));
      setMinStudents(Number(p.minStudents ?? 5));
    }
  }, [payload]);

  async function save() {
    if (!ruleId || !payload) return;
    setSaving(true);
    setErr('');
    try {
      const conds = [...payload.conditions];
      const c0 = conds[0];
      const nextConds =
        c0?.conditionType === 'no_teacher_with_students'
          ? [
              {
                conditionType: c0.conditionType,
                parameters: { minMinutes, minStudents },
                sortOrder: c0.sortOrder,
              },
            ]
          : conds.map((c) => ({
              conditionType: c.conditionType,
              parameters: c.parameters,
              sortOrder: c.sortOrder,
            }));
      const res = await schoolFetch(`/api/intelligence-rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cooldownSeconds: cooldown, conditions: nextConds }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr((j as { error?: string }).error ?? res.statusText);
        return;
      }
      qc.invalidateQueries({ queryKey: ['intel-rules'] });
      qc.invalidateQueries({ queryKey: ['intel-rule-audit', ruleId] });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const open = ruleId != null;

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="flex max-h-[90vh] flex-col border border-slate-800 bg-slate-950 p-4 text-sm text-slate-200 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Edit rule</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300">
            ✕
          </button>
        </div>
        {isLoading && <p className="text-xs text-slate-500">Loading…</p>}
        {payload?.rule && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            <p className="text-xs text-slate-500">{payload.rule.eventType}</p>
            <p className="font-medium">{payload.rule.name}</p>
            <label className="block text-xs text-slate-500">
              Cooldown (seconds)
              <input
                type="number"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
                value={cooldown}
                onChange={(e) => setCooldown(Number(e.target.value))}
              />
            </label>
            {payload.conditions[0]?.conditionType === 'no_teacher_with_students' && (
              <>
                <label className="block text-xs text-slate-500">
                  Min gap (minutes)
                  <input
                    type="number"
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
                    value={minMinutes}
                    onChange={(e) => setMinMinutes(Number(e.target.value))}
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  Min students
                  <input
                    type="number"
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
                    value={minStudents}
                    onChange={(e) => setMinStudents(Number(e.target.value))}
                  />
                </label>
              </>
            )}
            <div className="rounded border border-slate-800 bg-slate-900/40 p-3">
              <p className="mb-2 text-xs font-medium text-slate-400">Recent changes (audit)</p>
              {auditForRule.length === 0 ? (
                <p className="text-xs text-slate-600">No audit entries yet for this rule.</p>
              ) : (
                <ul className="max-h-40 space-y-2 overflow-y-auto text-xs">
                  {auditForRule.map((a) => (
                    <li key={a.id} className="border-b border-slate-800/80 pb-2 last:border-0">
                      <span className="text-slate-300">{a.action}</span>
                      {a.actorId != null && <span className="ml-2 text-slate-500">actor #{a.actorId}</span>}
                      <span className="ml-2 text-slate-500">{new Date(a.createdAt).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-xs text-slate-600">
              Threshold changes bump rule version and are audited. See project README for full rule semantics.
            </p>
            {err && <p className="text-xs text-red-400">{err}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void save()} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
