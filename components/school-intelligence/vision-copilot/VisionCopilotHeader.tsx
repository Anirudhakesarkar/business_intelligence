'use client';

import { ScanEye, RefreshCw, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SIModuleHeader } from '@/components/school-intelligence/SIModuleHeader';

type Props = {
  lastRefreshed: string;
  onRefresh: () => void;
};

export function VisionCopilotHeader({ lastRefreshed, onRefresh }: Props) {
  return (
    <SIModuleHeader
      title="Vision Copilot"
      description="Ask operational questions across cameras, alerts, zones, and evidence."
      icon={<ScanEye className="h-6 w-6" />}
      tone="sky"
      eyebrow={
        <span className="inline-flex items-center gap-2">
          School Intelligence
          <Badge variant="success" className="normal-case tracking-normal">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-green-400" aria-hidden />
            Live UI Preview
          </Badge>
        </span>
      }
      actions={
        <>
          <span className="hidden text-xs text-slate-500 sm:inline">Last refreshed {lastRefreshed}</span>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-700 text-slate-300 hover:border-sky-600"
            onClick={onRefresh}
            aria-label="Refresh data"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-700 text-slate-300 hover:border-sky-600"
            aria-label="Export report"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </>
      }
    />
  );
}
