'use client';

import { useEffect, useState } from 'react';
import { MapPin, Building2, SlidersHorizontal, X } from 'lucide-react';
import { schoolApiGet } from '@/lib/school-management/api';

const ORG_ID = 1;

export type SMFilters = {
  siteId: string;
  buildingId: string;
};

type Option = { id: string; label: string };

type Props = {
  filters: SMFilters;
  onChange: (f: SMFilters) => void;
  /** Extra filter slots rendered after the site/building selects */
  children?: React.ReactNode;
  /** Called when the clear-all button is clicked — caller should reset its own extra filters too */
  onClearAll?: () => void;
  /** Whether any caller-owned filters are active (drives the "Clear" button visibility) */
  hasExtraActive?: boolean;
};

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="group flex min-w-0 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-2.5 py-1.5 text-sm transition-colors hover:border-slate-700 cursor-pointer">
      <span className="text-slate-500 transition-colors group-focus-within:text-sky-400">{icon}</span>
      <span className="sr-only">{label}</span>
      {children}
    </label>
  );
}

export function SMFilterBar({ filters, onChange, children, onClearAll, hasExtraActive }: Props) {
  const [sites, setSites] = useState<Option[]>([]);
  const [buildings, setBuildings] = useState<Option[]>([]);
  const [allBuildings, setAllBuildings] = useState<Option[]>([]);

  useEffect(() => {
    void schoolApiGet<Array<{ id: number | string; name: string }>>(`/api/sites?organizationId=${ORG_ID}`)
      .then((rows) => {
        if (Array.isArray(rows)) {
          setSites([{ id: '', label: 'All Sites' }, ...rows.map((r) => ({ id: String(r.id), label: r.name }))]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    void schoolApiGet<Array<{ id: number | string; name: string; siteId?: number | string }>>(`/api/buildings?organizationId=${ORG_ID}`)
      .then((rows) => {
        if (Array.isArray(rows)) {
          setAllBuildings(rows.map((r) => ({ id: String(r.id), label: r.name, siteId: String(r.siteId ?? '') } as Option & { siteId: string })));
        }
      })
      .catch(() => {});
  }, []);

  // Filter buildings by selected site
  useEffect(() => {
    const filtered = filters.siteId
      ? (allBuildings as Array<Option & { siteId: string }>).filter((b) => b.siteId === filters.siteId)
      : allBuildings;
    setBuildings([{ id: '', label: 'All Buildings' }, ...filtered]);
    // Reset building if it no longer belongs to the selected site
    if (filters.buildingId && filters.siteId) {
      const still = (allBuildings as Array<Option & { siteId: string }>).find(
        (b) => String(b.id) === filters.buildingId && b.siteId === filters.siteId
      );
      if (!still) onChange({ ...filters, buildingId: '' });
    }
  }, [filters.siteId, allBuildings]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof SMFilters>(key: K, value: SMFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const isActive = filters.siteId || filters.buildingId || hasExtraActive;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/60 px-3 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 pl-1 pr-2 text-xs uppercase tracking-wider text-slate-500">
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filters
      </div>

      <Field icon={<MapPin className="h-4 w-4" />} label="Site">
        <select
          value={filters.siteId}
          onChange={(e) => set('siteId', e.target.value)}
          className="bg-transparent text-slate-200 focus:outline-none [color-scheme:dark] text-sm"
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </Field>

      <Field icon={<Building2 className="h-4 w-4" />} label="Building">
        <select
          value={filters.buildingId}
          onChange={(e) => set('buildingId', e.target.value)}
          className="bg-transparent text-slate-200 focus:outline-none [color-scheme:dark] text-sm"
        >
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </select>
      </Field>

      {/* Page-specific extra filters */}
      {children}

      {isActive && (
        <button
          onClick={() => {
            onChange({ siteId: '', buildingId: '' });
            onClearAll?.();
          }}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="h-3 w-3" /> Clear
        </button>
      )}
    </div>
  );
}

/** Inline select styled to match the filter bar */
export function SMFilterSelect({
  icon,
  label,
  value,
  onChange,
  options,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <label className="group flex min-w-0 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-2.5 py-1.5 text-sm transition-colors hover:border-slate-700 cursor-pointer">
      <span className="text-slate-500 transition-colors group-focus-within:text-sky-400">{icon}</span>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-slate-200 focus:outline-none [color-scheme:dark] text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
