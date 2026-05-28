import { Badge } from '@/components/ui/badge';
import type { EdgeServerStatus } from './types';

const cls: Record<EdgeServerStatus, string> = {
  Draft: 'bg-slate-700 text-slate-100 border-slate-600',
  'Pending Activation': 'bg-amber-600/20 text-amber-300 border-amber-500/40',
  Active: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40',
  Offline: 'bg-rose-600/20 text-rose-300 border-rose-500/40',
  Suspended: 'bg-orange-600/20 text-orange-300 border-orange-500/40',
  Decommissioned: 'bg-zinc-700 text-zinc-300 border-zinc-600',
};

export function EdgeServerStatusBadge({ status }: { status: EdgeServerStatus }) {
  return <Badge className={cls[status] || cls.Draft}>{status}</Badge>;
}
