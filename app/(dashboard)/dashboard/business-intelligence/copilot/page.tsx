'use client';

import { useState } from 'react';
import { Bot, Sparkles, Info } from 'lucide-react';
import { BIFilterBar, type BIFilters } from '@/components/business-intelligence/BIFilterBar';
import { BICopilotChat } from '@/components/business-intelligence/BICopilotChat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SUGGESTED_QUESTIONS } from '@/lib/business-intelligence/copilot-context-builder';

export default function BICopilotPage() {
  const [filters, setFilters] = useState<BIFilters>({ organizationId: '', siteId: '', dateRange: '7d' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-100">
          <Bot className="h-7 w-7 text-blue-400" />
          AI Copilot
          <Sparkles className="h-5 w-5 text-blue-400" />
        </h1>
        <p className="text-sm text-slate-400">
          Ask questions about your site, alerts, cameras, and operations. The Copilot uses structured
          business intelligence data — not unrestricted database queries.
        </p>
      </div>

      <BIFilterBar filters={filters} onChange={setFilters} />

      {/* Architecture note */}
      <Card className="border-blue-900/50 bg-blue-950/20">
        <CardContent className="flex items-start gap-3 p-4">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-400" />
          <div className="text-xs text-slate-400 space-y-1">
            <p className="font-medium text-blue-300">How Copilot Works</p>
            <p>
              User question → Cloud API builds structured summary → AI receives safe context →
              AI explains insight → Management approves action. GPT never has direct database access.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Main chat */}
      <BICopilotChat
        organizationId={filters.organizationId}
        siteId={filters.siteId}
        dateRange={filters.dateRange}
      />

      {/* Full suggested questions */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-100">All Suggested Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <div
                key={q}
                className="rounded-lg border border-slate-800 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/50 cursor-pointer transition-colors"
              >
                {q}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Copilot flow diagram */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-100">Copilot Processing Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
            {['User Question', 'Cloud API', 'Structured Summary', 'AI Analysis', 'Insight', 'Management Action'].map((step, i, arr) => (
              <div key={step} className="flex items-center gap-2">
                <div className="rounded-full border border-blue-700/40 bg-blue-950/30 px-3 py-1.5 text-blue-300">{step}</div>
                {i < arr.length - 1 && <span className="text-slate-600">→</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
