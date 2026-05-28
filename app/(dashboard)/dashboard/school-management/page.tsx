'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SMPageHeader } from '@/components/school-management/SMPageHeader';
import { SetupProgressBar } from '@/components/school-management/SetupProgressBar';
import { useMissingData, useSeedDemo, useSetupHealth } from '@/components/school-management/useSchoolFoundation';

const LINKS = [
  { href: '/dashboard/school-management/master-data', label: 'Master Data' },
  { href: '/dashboard/school-management/cameras', label: 'Cameras and Mapping' },
  { href: '/dashboard/school-management/timetable', label: 'Timetable' },
  { href: '/dashboard/school-management/staff-duty', label: 'Staff Duty Roster' },
  { href: '/dashboard/school-management/calendar', label: 'School Calendar' },
];

export default function SchoolManagementOverviewPage() {
  const { data, isLoading, refetch } = useSetupHealth();
  const { data: missingData } = useMissingData();
  const seed = useSeedDemo();
  const health = data ?? {
    completionPercent: 0,
    camerasMapped: { complete: 0, total: 0 },
    roomsConfigured: { complete: 0, total: 0 },
    timetableEntries: 0,
    rosterEntries: 0,
    calendarDays: 0,
    missing: ['Load demo seed to begin'],
    isReadyForPhase2: false,
    nextAction: { label: 'Register cameras', href: '/dashboard/school-management/cameras', reason: 'Start foundation setup.' },
    calendarSummary: { totalDays: 0, workingDays: 0, holidays: 0, examDays: 0, eventDays: 0, halfDays: 0, specialDays: 0 },
  };
  const cal = health.calendarSummary;
  const next = health.nextAction;

  return (
    <div className="space-y-6">
      <SMPageHeader
        title="School Management"
        subtitle="Foundation setup: campus hierarchy, cameras, timetable, calendar, and duty roster."
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => refetch()}>Refresh</Button>
            <Button size="sm" onClick={() => seed.mutate()} disabled={seed.isPending}>Load demo seed</Button>
          </div>
        }
      />
      <SetupProgressBar percent={health.completionPercent ?? 0} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ['Cameras mapped', `${health.camerasMapped?.complete ?? 0}/${health.camerasMapped?.total ?? 0}`],
          ['Rooms configured', `${health.roomsConfigured?.complete ?? 0}/${health.roomsConfigured?.total ?? 0}`],
          ['Timetable entries', health.timetableEntries ?? 0],
          ['Roster entries', health.rosterEntries ?? 0],
          ['Calendar days', health.calendarDays ?? 0],
        ].map(([label, val]) => (
          <Card key={label} className="border-slate-800 bg-slate-900">
            <CardHeader className="pb-1"><CardTitle className="text-xs text-slate-500">{label}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-slate-100">{val}</p></CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-300">Calendar status</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-xs text-slate-400">
          <span>{cal?.workingDays ?? 0} working</span>
          <span>{cal?.holidays ?? 0} holidays</span>
          <span>{cal?.examDays ?? 0} exams</span>
          <span>{cal?.eventDays ?? 0} events</span>
          <span>{cal?.halfDays ?? 0} half days</span>
          <span className="text-slate-500">({cal?.totalDays ?? 0} days configured)</span>
        </CardContent>
      </Card>
      {next && !health.isReadyForPhase2 && (
        <Card className="border-sky-500/40 bg-sky-500/5">
          <CardHeader><CardTitle className="text-sm text-sky-300">Next recommended setup action</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-slate-300">{next.reason}</p>
            <Link href={next.href} className="inline-flex text-sm font-medium text-sky-400 hover:underline">{next.label} →</Link>
          </CardContent>
        </Card>
      )}
      {health.missing?.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader><CardTitle className="text-sm text-amber-400">Missing setup items</CardTitle></CardHeader>
          <CardContent>
            <ul className="list-inside list-disc text-sm text-slate-300">{health.missing.map((m: string) => <li key={m}>{m}</li>)}</ul>
            {(missingData?.unmappedCameras?.length ?? 0) > 0 && (
              <p className="mt-2 text-xs text-amber-300/80">Unmapped cameras: {missingData.unmappedCameras.join(', ')}</p>
            )}
          </CardContent>
        </Card>
      )}
      {health.isReadyForPhase2 && <p className="text-sm text-green-400">School is ready for Phase 2 intelligence modules.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-sky-400 hover:bg-slate-800">{l.label} →</Link>
        ))}
      </div>
      {isLoading && <p className="text-xs text-slate-500">Loading setup health…</p>}
    </div>
  );
}
