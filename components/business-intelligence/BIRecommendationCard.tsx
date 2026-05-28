'use client';

import { CheckCircle2, X, Lightbulb } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Recommendation } from '@/lib/business-intelligence/recommendation-engine';

type Props = {
  rec: Recommendation;
  onApprove?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onMarkImplemented?: (id: string) => void;
  status?: 'Open' | 'Approved' | 'Dismissed' | 'Implemented';
};

function priorityVariant(p: string): 'destructive' | 'warning' | 'secondary' {
  if (p === 'High') return 'destructive';
  if (p === 'Medium') return 'warning';
  return 'secondary';
}

export function BIRecommendationCard({ rec, onApprove, onDismiss, onMarkImplemented, status = 'Open' }: Props) {
  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-blue-600/15 p-1.5">
              <Lightbulb className="h-4 w-4 text-blue-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-100">{rec.title}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{rec.category} · Impact: {rec.impactArea}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={priorityVariant(rec.priority)}>{rec.priority}</Badge>
            {status !== 'Open' && (
              <Badge variant={status === 'Implemented' ? 'success' : status === 'Approved' ? 'secondary' : 'outline'}>
                {status}
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2 text-xs text-slate-400">
          <div>
            <span className="font-medium text-slate-300">Reason: </span>
            {rec.reason}
          </div>
          <div>
            <span className="font-medium text-slate-300">Suggested Action: </span>
            {rec.suggestedAction}
          </div>
          <div>
            <span className="font-medium text-slate-300">Expected Benefit: </span>
            {rec.expectedBenefit}
          </div>
        </div>

        {status === 'Open' && (
          <div className="mt-4 flex flex-wrap gap-2">
            {onApprove && (
              <Button size="sm" variant="default" className="gap-1" onClick={() => onApprove(rec.id)}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
              </Button>
            )}
            {onMarkImplemented && (
              <Button size="sm" variant="outline" onClick={() => onMarkImplemented(rec.id)}>
                Mark Implemented
              </Button>
            )}
            {onDismiss && (
              <Button size="sm" variant="ghost" className="gap-1 text-slate-500" onClick={() => onDismiss(rec.id)}>
                <X className="h-3.5 w-3.5" /> Dismiss
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
