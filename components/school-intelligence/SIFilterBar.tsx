'use client';

import { useEffect, useState } from 'react';
import { Building2, MapPin, Calendar, SlidersHorizontal } from 'lucide-react';
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

const DEMO_ORGS: OrgOption[] = [
  { id: '', label: 'All Organizations' },
  { id: 'demo-school', label: 'Eurokids Academy (demo school)' },
];

const DEMO_SITES: SiteOption[] = [
  { id: '', label: 'All Sites' },
  { id: 'site-main', label: 'Main Campus' },
  { id: 'site-annex', label: 'Annex Building' },
];

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
  const [orgs, setOrgs] = useState<OrgOption[]>(DEMO_ORGS);
  const [sites, setSites] = useState<SiteOption[]>(DEMO_SITES);

  // Try to load real orgs/sites; fall back to demo silently.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/organizations');
        if (!res.ok) return;
        const data = await res.json();
        const rows = (data.organizations ?? data.rows ?? data) as Array<{ id: number | string; name: string }>;
        if (!cancelled && Array.isArray(rows) && rows.length) {
          setOrgs([{ id: '', label: 'All Organizations' }, ...rows.map((r) => ({ id: String(r.id), label: r.name }))]);
        }
      } catch {
        /* keep demo */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/sites');
        if (!res.ok) return;
        const data = await res.json();
        const rows = (data.sites ?? data.rows ?? data) as Array<{ id: number | string; name: string }>;
        if (!cancelled && Array.isArray(rows) && rows.length) {
          setSites([{ id: '', label: 'All Sites' }, ...rows.map((r) => ({ id: String(r.id), label: r.name }))]);
        }
      } catch {
        /* keep demo */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
  );
}
