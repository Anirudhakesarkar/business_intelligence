'use client';

import { Video, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export type CameraHealthSummary = {
  total: number;
  online: number;
  streamDrops: number;
  offlineCritical: number;
  issues?: Array<{ name: string; issue: string; count: number }>;
};

const DEMO: CameraHealthSummary = {
  total: 24,
  online: 22,
  streamDrops: 8,
  offlineCritical: 1,
  issues: [
    { name: 'CAM-HAN-014', issue: 'Frequent stream drops', count: 28 },
    { name: 'CAM-HAN-007', issue: 'Offline — no heartbeat', count: 1 },
  ],
};

type Props = { data?: CameraHealthSummary; isLoading?: boolean };

export function BICameraHealthCard({ data, isLoading }: Props) {
  const d = data ?? DEMO;
  const healthPct = d.total > 0 ? Math.round((d.online / d.total) * 100) : 0;

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
          <Video className="h-4 w-4 text-blue-400" /> Camera Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-slate-800" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-800" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-green-400" />
                <span className="text-sm text-slate-300">{d.online}/{d.total} Online</span>
              </div>
              <Badge variant={healthPct >= 90 ? 'success' : healthPct >= 70 ? 'warning' : 'destructive'}>
                {healthPct}%
              </Badge>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all ${healthPct >= 90 ? 'bg-green-500' : healthPct >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${healthPct}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-400">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
                {d.streamDrops} stream drops
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <WifiOff className="h-3.5 w-3.5 text-red-400" />
                {d.offlineCritical} critical offline
              </div>
            </div>

            {d.issues && d.issues.length > 0 && (
              <div className="mt-1 space-y-1.5 border-t border-slate-800 pt-2">
                {d.issues.slice(0, 3).map((issue) => (
                  <div key={issue.name} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-300">{issue.name}</span>
                    <span className="text-slate-500">{issue.issue}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {!data && !isLoading && (
          <p className="mt-2 text-center text-xs text-slate-600">Demo data shown</p>
        )}
      </CardContent>
    </Card>
  );
}
