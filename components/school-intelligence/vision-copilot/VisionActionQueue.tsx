'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { VisionAction } from '@/lib/school-intelligence/vision-copilot-mock';
import { cn } from '@/lib/utils';

type Props = {
  initialActions: VisionAction[];
};

type ActionState = VisionAction & { status: 'pending' | 'approved' | 'dismissed' };

const PRIORITY_VARIANT: Record<VisionAction['priority'], 'destructive' | 'warning' | 'secondary'> = {
  high: 'destructive',
  medium: 'warning',
  low: 'secondary',
};

export function VisionActionQueue({ initialActions }: Props) {
  const [actions, setActions] = useState<ActionState[]>(
    initialActions.map((a) => ({ ...a, status: 'pending' }))
  );

  const updateStatus = (id: string, status: 'approved' | 'dismissed') =>
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));

  const pending = actions.filter((a) => a.status === 'pending');

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-100">Action queue</CardTitle>
        <p className="text-xs text-slate-500">{pending.length} pending recommendations</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action) => (
          <div
            key={action.id}
            className={cn(
              'flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3 sm:flex-row sm:items-center sm:justify-between',
              action.status === 'approved' && 'opacity-60',
              action.status === 'dismissed' && 'opacity-40'
            )}
          >
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-sm text-slate-200',
                  action.status === 'dismissed' && 'line-through'
                )}
              >
                {action.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">Owner: {action.owner}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant={PRIORITY_VARIANT[action.priority]} className="capitalize">
                {action.priority}
              </Badge>
              {action.status === 'pending' ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-green-700/50 text-green-400 hover:bg-green-950/40"
                    onClick={() => updateStatus(action.id, 'approved')}
                    aria-label={`Approve: ${action.title}`}
                  >
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-slate-400 hover:text-slate-200"
                    onClick={() => updateStatus(action.id, 'dismissed')}
                    aria-label={`Dismiss: ${action.title}`}
                  >
                    <XCircle className="mr-1 h-3.5 w-3.5" />
                    Dismiss
                  </Button>
                </>
              ) : (
                <Badge variant={action.status === 'approved' ? 'success' : 'secondary'} className="capitalize">
                  {action.status}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
