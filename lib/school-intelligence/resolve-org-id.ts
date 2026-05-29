import type { SIFilters } from '@/lib/school-intelligence/types';

/** Map SIFilterBar organization selection to API organization id. */
export function resolveOrganizationId(filters: SIFilters, defaultId = 1): number {
  const raw = filters.organizationId?.trim();
  if (!raw || raw === 'demo-school') return defaultId;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultId;
}
