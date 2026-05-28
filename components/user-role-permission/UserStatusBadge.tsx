import { Badge } from '@/components/ui/badge';
import type { UserStatus } from './types';
const cls: Record<UserStatus, string> = {
  Invited: 'bg-blue-600/20 text-blue-300 border-blue-500/40',
  Active: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40',
  Inactive: 'bg-slate-700 text-slate-300 border-slate-600',
  Suspended: 'bg-rose-600/20 text-rose-300 border-rose-500/40',
};
export function UserStatusBadge({status}:{status:UserStatus}) { return <Badge className={cls[status] || cls.Invited}>{status}</Badge>; }
