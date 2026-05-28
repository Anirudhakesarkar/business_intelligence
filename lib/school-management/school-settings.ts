export type SchoolSettings = {
  organizationId: number;
  timezone: string;
  academicYear: string;
  timetableOverlapPolicy: 'block' | 'warn';
  phase2StrictMode: boolean;
};

const settings = new Map<number, SchoolSettings>();

export function getSchoolSettings(organizationId: number): SchoolSettings {
  return settings.get(organizationId) ?? {
    organizationId,
    timezone: 'Asia/Kolkata',
    academicYear: '2025-26',
    timetableOverlapPolicy: 'block',
    phase2StrictMode: false,
  };
}

export function setSchoolSettings(organizationId: number, next: SchoolSettings) {
  settings.set(organizationId, next);
}
