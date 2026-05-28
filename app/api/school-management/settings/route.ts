import '@/lib/school-persistence/init';
import { NextRequest } from 'next/server';
import { json } from '@/lib/school-foundation/json';
import { getComplianceConfig, logAudit, patchComplianceConfig, setAuditActor } from '@/lib/school-foundation/store';

type SchoolSettings = {
  organizationId: number;
  timezone: string;
  academicYear: string;
  timetableOverlapPolicy: 'block' | 'warn';
  phase2StrictMode: boolean;
};

const settings = new Map<number, SchoolSettings>();

function getSchoolSettings(organizationId: number): SchoolSettings {
  return settings.get(organizationId) ?? {
    organizationId,
    timezone: 'Asia/Kolkata',
    academicYear: '2025-26',
    timetableOverlapPolicy: 'block',
    phase2StrictMode: false,
  };
}

function setSchoolSettings(organizationId: number, next: SchoolSettings) {
  settings.set(organizationId, next);
}

export async function GET(req: NextRequest) {
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const compliance = getComplianceConfig(organizationId);
  return json({ ...getSchoolSettings(organizationId), compliance });
}

export async function PATCH(req: NextRequest) {
  const organizationId = Number(req.nextUrl.searchParams.get('organizationId') ?? 1);
  const body = await req.json().catch(() => ({}));
  const cur = getSchoolSettings(organizationId);
  const next: SchoolSettings = {
    ...cur,
    timezone: body.timezone ?? cur.timezone,
    academicYear: body.academicYear ?? cur.academicYear,
    timetableOverlapPolicy: body.timetableOverlapPolicy ?? cur.timetableOverlapPolicy,
    phase2StrictMode: body.phase2StrictMode ?? cur.phase2StrictMode,
  };
  const before = getSchoolSettings(organizationId);
  if (body.actorId) setAuditActor(Number(body.actorId));
  setSchoolSettings(organizationId, next);
  if (body.compliance) patchComplianceConfig(organizationId, body.compliance);
  logAudit('update', 'school_settings', organizationId, next, before);
  return json({ ...next, compliance: getComplianceConfig(organizationId) });
}
