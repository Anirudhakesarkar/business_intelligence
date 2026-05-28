import type { SiteStatus } from './types';

const cls: Record<SiteStatus, string> = {
  Draft: 'bg-slate-700 text-slate-200',
  'Survey Pending': 'bg-amber-600/20 text-amber-300 border border-amber-500/30',
  'Installation Pending': 'bg-amber-600/20 text-amber-300 border border-amber-500/30',
  'Edge Setup Pending': 'bg-amber-600/20 text-amber-300 border border-amber-500/30',
  'Camera Mapping Pending': 'bg-amber-600/20 text-amber-300 border border-amber-500/30',
  'AI Configuration Pending': 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30',
  'User Training Pending': 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30',
  Live: 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30',
  'On Hold': 'bg-orange-600/20 text-orange-300 border border-orange-500/30',
  Inactive: 'bg-slate-700 text-slate-300 border border-slate-600',
};

export function SiteStatusBadge({ status }: { status: SiteStatus }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cls[status]}`}>{status}</span>;
}
