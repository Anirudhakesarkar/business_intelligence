'use client';

import { useEffect, useState } from 'react';
import { Building2, MapPin, Calendar, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import { DATE_RANGE_OPTIONS } from '@/lib/school-intelligence/constants';
import { presetDateBounds, todayIso } from '@/lib/school-intelligence/date-range';
import type { SIDateRange, SIFilters } from '@/lib/school-intelligence/types';

type OrgOption = { id: string; label: string };
type SiteOption = { id: string; label: string };

type Props = {
  filters: SIFilters;
  onChange: (f: SIFilters) => void;
  showDateRange?: boolean;
};

const EMPTY_ORGS: OrgOption[] = [{ id: '', label: 'All Organizations' }];
const EMPTY_SITES: SiteOption[] = [{ id: '', label: 'All Sites' }];

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="group flex min-w-0 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-2.5 py-1.5 text-sm transition-colors hover:border-slate-700">
      <span className="text-slate-500 transition-colors group-focus-within:text-sky-400">{icon}</span>
      <span className="sr-only">{label}</span>
      {children}
    </label>
  );
}

export function SIFilterBar({ filters, onChange, showDateRange = true }: Props) {
  const [orgs, setOrgs] = useState<OrgOption[]>(EMPTY_ORGS);
  const [sites, setSites] = useState<SiteOption[]>(EMPTY_SITES);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [sitesError, setSitesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setOrgsError(null);
      try {
        const res = await fetch('/api/organizations?pageSize=100');
        if (!res.ok) throw new Error(`Organizations API returned ${res.status}`);
        const data = await res.json();
        const rows = (data.data ?? data.organizations ?? data.rows ?? []) as Array<{
          id: number | string;
          name?: string;
          organization_name?: string;
        }>;
        if (!Array.isArray(rows) || rows.length === 0) {
          if (!cancelled) {
            setOrgs(EMPTY_ORGS);
            setOrgsError('No organizations found in Postgres.');
          }
          return;
        }
        if (!cancelled) {
          setOrgs([
            { id: '', label: 'All Organizations' },
            ...rows.map((r) => ({
              id: String(r.id),
              label: r.organization_name ?? r.name ?? `Organization ${r.id}`,
            })),
          ]);
        }
      } catch (e) {
        if (!cancelled) {
          setOrgs(EMPTY_ORGS);
          setOrgsError(e instanceof Error ? e.message : 'Failed to load organizations');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setSitesError(null);
      try {
        const orgQ = filters.organizationId ? `?organizationId=${encodeURIComponent(filters.organizationId)}` : '';
        const res = await fetch(`/api/sites${orgQ}`);
        if (!res.ok) throw new Error(`Sites API returned ${res.status}`);
        const data = await res.json();
        const rows = (data.sites ?? data.rows ?? data) as Array<{ id: number | string; name: string }>;
        if (!Array.isArray(rows) || rows.length === 0) {
          if (!cancelled) {
            setSites(EMPTY_SITES);
            setSitesError('No sites/campuses found in Postgres.');
          }
          return;
        }
        if (!cancelled) {
          setSites([
            { id: '', label: 'All Sites' },
            ...rows.map((r) => ({ id: String(r.id), label: r.name })),
          ]);
        }
      } catch (e) {
        if (!cancelled) {
          setSites(EMPTY_SITES);
          setSitesError(e instanceof Error ? e.message : 'Failed to load sites');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters.organizationId]);

  const set = <K extends keyof SIFilters>(key: K, value: SIFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const handleDateRangeChange = (value: SIDateRange) => {
    if (value === 'custom') {
      const bounds =
        filters.dateRange === 'custom'
          ? { from: filters.dateFrom ?? todayIso(), to: filters.dateTo ?? todayIso() }
          : presetDateBounds(filters.dateRange);
      onChange({ ...filters, dateRange: 'custom', dateFrom: bounds.from, dateTo: bounds.to });
      return;
    }
    onChange({ ...filters, dateRange: value, dateFrom: undefined, dateTo: undefined });
  };

  const dateInputClass =
    'bg-transparent text-slate-200 focus:outline-none [color-scheme:dark]';

  return (
    <div className="space-y-2">
      {(orgsError || sitesError) && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            {orgsError && <p>{orgsError}</p>}
            {sitesError && <p>{sitesError}</p>}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/60 px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-1.5 pl-1 pr-2 text-xs uppercase tracking-wider text-slate-500">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
        </div>

        <Field icon={<Building2 className="h-4 w-4" />} label="Organization">
          <select
            value={filters.organizationId}
            onChange={(e) => set('organizationId', e.target.value)}
            className="bg-transparent text-slate-200 focus:outline-none [color-scheme:dark]"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </Field>

        <Field icon={<MapPin className="h-4 w-4" />} label="Site">
          <select
            value={filters.siteId}
            onChange={(e) => set('siteId', e.target.value)}
            className="bg-transparent text-slate-200 focus:outline-none [color-scheme:dark]"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </Field>

        {showDateRange && (
          <>
            <Field icon={<Calendar className="h-4 w-4" />} label="Date range">
              <select
                value={filters.dateRange}
                onChange={(e) => handleDateRangeChange(e.target.value as SIDateRange)}
                className={dateInputClass}
              >
                {DATE_RANGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            {filters.dateRange === 'custom' && (
              <>
                <Field icon={<Calendar className="h-4 w-4" />} label="Start date">
                  <input
                    type="date"
                    value={filters.dateFrom ?? ''}
                    max={filters.dateTo ?? undefined}
                    onChange={(e) =>
                      onChange({ ...filters, dateRange: 'custom', dateFrom: e.target.value })
                    }
                    className={dateInputClass}
                  />
                </Field>
                <Field icon={<Calendar className="h-4 w-4" />} label="End date">
                  <input
                    type="date"
                    value={filters.dateTo ?? ''}
                    min={filters.dateFrom ?? undefined}
                    onChange={(e) =>
                      onChange({ ...filters, dateRange: 'custom', dateTo: e.target.value })
                    }
                    className={dateInputClass}
                  />
                </Field>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
