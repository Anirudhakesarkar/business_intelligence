'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SMPageHeader } from '@/components/school-management/SMPageHeader';
import { useSetupHealth } from '@/components/school-management/useSchoolFoundation';
import { schoolFetch } from '@/lib/school-auth/client-fetch';

type ChecklistItem = { id: string; label: string; required: boolean };

type ComplianceConfig = {
  organizationId: number;
  safetyRules: string[];
  restrictedZoneIds: number[];
  auditChecklist: ChecklistItem[];
  updatedAt: string;
};

type Settings = {
  timezone: string;
  academicYear: string;
  timetableOverlapPolicy: 'block' | 'warn';
  phase2StrictMode: boolean;
  compliance?: ComplianceConfig;
};

type Zone = { id: number; name: string; isRiskZone?: boolean; riskCategory?: string };
type Camera = { id: number; name: string; purpose: string; metadata?: { teachingZones?: { boardPolygon?: number[][]; deskPolygon?: number[][] } } };

type AuditEntry = { id: number; action: string; entityType: string; entityId?: number; createdAt: string };

export default function Page() {
  const { data } = useSetupHealth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [classroomCam, setClassroomCam] = useState<Camera | null>(null);
  const [boardJson, setBoardJson] = useState('[[0,0],[100,0],[100,40]]');
  const [deskJson, setDeskJson] = useState('[[0,50],[100,50],[100,100]]');
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [saving, setSaving] = useState(false);

  const load = () => {
    void schoolFetch('/api/school-management/settings?organizationId=1').then((r) => r.json()).then((s: Settings) => {
      setSettings(s);
      if (s.compliance?.auditChecklist?.length) {
        /* keep */
      }
    });
    void schoolFetch('/api/zones').then((r) => r.json()).then(setZones);
    void schoolFetch('/api/cameras?organizationId=1').then((r) => r.json()).then((cams: Camera[]) => {
      const cam = cams.find((c) => c.purpose === 'Classroom') ?? cams[0];
      setClassroomCam(cam ?? null);
      if (cam?.metadata?.teachingZones?.boardPolygon) {
        setBoardJson(JSON.stringify(cam.metadata.teachingZones.boardPolygon));
        setDeskJson(JSON.stringify(cam.metadata.teachingZones.deskPolygon ?? []));
      }
    });
    void schoolFetch('/api/school-management/audit-log?limit=30').then((r) => r.json()).then((j) => setAudit(j.entries ?? []));
  };

  useEffect(() => { load(); }, []);

  const updateChecklist = (id: string, patch: Partial<ChecklistItem>) => {
    if (!settings?.compliance) return;
    setSettings({
      ...settings,
      compliance: {
        ...settings.compliance,
        auditChecklist: settings.compliance.auditChecklist.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
    });
  };

  const toggleRestrictedZone = (zoneId: number) => {
    if (!settings?.compliance) return;
    const ids = settings.compliance.restrictedZoneIds;
    const next = ids.includes(zoneId) ? ids.filter((z) => z !== zoneId) : [...ids, zoneId];
    setSettings({ ...settings, compliance: { ...settings.compliance, restrictedZoneIds: next } });
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    await schoolFetch('/api/school-management/settings?organizationId=1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (classroomCam) {
      try {
        const boardPolygon = JSON.parse(boardJson) as number[][];
        const deskPolygon = JSON.parse(deskJson) as number[][];
        await schoolFetch(`/api/cameras/${classroomCam.id}/teaching-zones`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ boardPolygon, deskPolygon }),
        });
      } catch {
        /* invalid JSON — user can fix */
      }
    }
    setSaving(false);
    load();
  };

  return (
    <div className="space-y-6">
      <SMPageHeader title="Settings" subtitle="Organization defaults, compliance checklist, teaching zones, and audit trail." />
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader><CardTitle className="text-sm text-slate-200">Phase 2 readiness</CardTitle></CardHeader>
        <CardContent className="text-sm text-slate-400">
          {data?.isReadyForPhase2 ? 'Ready for Phase 2.' : 'Complete missing items on overview.'}
          {settings && (
            <label className="mt-3 flex items-center gap-2 text-slate-300">
              <input type="checkbox" checked={settings.phase2StrictMode} onChange={(e) => setSettings({ ...settings, phase2StrictMode: e.target.checked })} />
              Strict Phase 2 gate
            </label>
          )}
        </CardContent>
      </Card>
      {settings && (
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader><CardTitle className="text-sm text-slate-200">Organization defaults</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-500">Timezone<input className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} /></label>
            <label className="text-xs text-slate-500">Academic year<input className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" value={settings.academicYear} onChange={(e) => setSettings({ ...settings, academicYear: e.target.value })} /></label>
            <label className="text-xs text-slate-500">Timetable overlaps<select className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" value={settings.timetableOverlapPolicy} onChange={(e) => setSettings({ ...settings, timetableOverlapPolicy: e.target.value as 'block' | 'warn' })}><option value="block">Block</option><option value="warn">Warn only</option></select></label>
          </CardContent>
        </Card>
      )}
      {settings?.compliance && (
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader><CardTitle className="text-sm text-slate-200">Compliance checklist</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {settings.compliance.auditChecklist.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center gap-2 text-sm">
                <input type="checkbox" checked={item.required} onChange={(e) => updateChecklist(item.id, { required: e.target.checked })} />
                <input className="flex-1 min-w-[200px] rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200" value={item.label} onChange={(e) => updateChecklist(item.id, { label: e.target.value })} />
              </div>
            ))}
            <div className="pt-2">
              <p className="text-xs text-slate-500 mb-2">Restricted zones (link to risk areas)</p>
              <div className="flex flex-wrap gap-2">
                {zones.filter((z) => z.isRiskZone).map((z) => (
                  <label key={z.id} className="flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300">
                    <input type="checkbox" checked={settings.compliance!.restrictedZoneIds.includes(z.id)} onChange={() => toggleRestrictedZone(z.id)} />
                    {z.name} ({z.riskCategory})
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {classroomCam && (
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader><CardTitle className="text-sm text-slate-200">Teaching zones — {classroomCam.name}</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-500">Board polygon (JSON)<textarea className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs" rows={3} value={boardJson} onChange={(e) => setBoardJson(e.target.value)} /></label>
            <label className="text-xs text-slate-500">Desk polygon (JSON)<textarea className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs" rows={3} value={deskJson} onChange={(e) => setDeskJson(e.target.value)} /></label>
          </CardContent>
        </Card>
      )}
      <div className="flex gap-2"><Button size="sm" onClick={save} disabled={saving || !settings}>Save settings</Button><Button size="sm" variant="outline" onClick={load}>Refresh</Button></div>
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader><CardTitle className="text-sm text-slate-200">Audit log</CardTitle></CardHeader>
        <CardContent className="max-h-72 overflow-auto text-xs text-slate-400">
          {audit.map((e) => (
            <div key={e.id} className="border-b border-slate-800 py-1">
              {new Date(e.createdAt).toLocaleString()} — {e.action} {e.entityType}{e.entityId != null ? ` #${e.entityId}` : ''}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
