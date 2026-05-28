'use client';

import { Calendar, Building2, MapPin, Clock } from 'lucide-react';

export type BIFilters = {
  organizationId: string;
  siteId: string;
  dateRange: string;
};

type Props = {
  filters: BIFilters;
  onChange: (f: BIFilters) => void;
};

const DATE_RANGE_OPTIONS = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
];

export function BIFilterBar({ filters, onChange }: Props) {
  const set = (key: keyof BIFilters, value: string) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="flex items-center gap-2 text-slate-400">
        <Building2 className="h-4 w-4" />
        <select
          value={filters.organizationId}
          onChange={(e) => set('organizationId', e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Organizations</option>
        </select>
      </div>

      <div className="flex items-center gap-2 text-slate-400">
        <MapPin className="h-4 w-4" />
        <select
          value={filters.siteId}
          onChange={(e) => set('siteId', e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Sites</option>
        </select>
      </div>

      <div className="flex items-center gap-2 text-slate-400">
        <Calendar className="h-4 w-4" />
        <select
          value={filters.dateRange}
          onChange={(e) => set('dateRange', e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
        >
          {DATE_RANGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
        <Clock className="h-3.5 w-3.5" />
        Live intelligence
      </div>
    </div>
  );
}
