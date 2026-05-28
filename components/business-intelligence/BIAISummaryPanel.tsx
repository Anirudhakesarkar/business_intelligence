'use client';

import { Bot, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  summary?: string;
  isLoading?: boolean;
};

const PLACEHOLDER = `This site is ready for intelligence analysis. Once live alerts, incidents, and camera health data start syncing, Orion Alerts will calculate safety score, response score, camera health score, compliance score, and operational risk score.`;

export function BIAISummaryPanel({ summary, isLoading }: Props) {
  return (
    <Card className="border-slate-800 bg-gradient-to-r from-blue-950/40 to-slate-900">
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <div className="rounded-lg bg-blue-600/20 p-2">
          <Bot className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <CardTitle className="flex items-center gap-2 text-slate-100">
            AI Intelligence Summary
            <Sparkles className="h-4 w-4 text-blue-400" />
          </CardTitle>
          <p className="text-xs text-slate-500">Generated from structured site data</p>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-slate-800" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-slate-800" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-slate-800" />
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-slate-300">
            {summary || PLACEHOLDER}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
