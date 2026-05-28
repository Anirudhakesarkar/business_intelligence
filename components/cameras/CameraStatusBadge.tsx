import { Badge } from '@/components/ui/badge';

type CameraStatus = 'Draft'|'Active'|'Offline'|'Disabled'|'Maintenance'|'Decommissioned';
const cls: Record<CameraStatus,string> = {
  Draft:'bg-slate-700 text-slate-100 border-slate-600',
  Active:'bg-emerald-600/20 text-emerald-300 border-emerald-500/40',
  Offline:'bg-rose-600/20 text-rose-300 border-rose-500/40',
  Disabled:'bg-orange-600/20 text-orange-300 border-orange-500/40',
  Maintenance:'bg-amber-600/20 text-amber-300 border-amber-500/40',
  Decommissioned:'bg-zinc-700 text-zinc-300 border-zinc-600',
};
export function CameraStatusBadge({status}:{status:CameraStatus}) { return <Badge className={cls[status] || cls.Draft}>{status}</Badge>; }
export function CameraOnlineBadge({online}:{online:boolean}) { return <Badge className={online ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40':'bg-rose-600/20 text-rose-300 border-rose-500/40'}>{online?'Online':'Offline'}</Badge>; }
